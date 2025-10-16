// Skip thumbnail generation on Cloudflare Pages CI.
// CF_PAGES is injected during Pages builds (value "1").
if (process.env.CF_PAGES) {
    console.log("⏭️  Skipping thumbnail generation on Cloudflare Pages (using committed thumbs).");
    process.exit(0);
}

import fg from 'fast-glob';
import sharp from 'sharp';
import {promises as fs} from 'fs';
import path from 'path';

const SECTIONS = ['applications', 'archive', 'drawings', 'installations', 'paintings', 'plein-air', 'prints', 'site'];
const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'images');              // originals here
const OUT_DIR = path.join(ROOT, 'public', 'thumbs');    // thumbs here

const WIDTHS = [320, 480, 640, 720, 960, 1280, 1440, 1920];
const QUALITY_JPG = 82;
const QUALITY_WEBP = 82;
const QUALITY_AVIF = 50;

// …
const DATA_THUMBS_DIR = path.join(ROOT, 'src', 'data', 'thumbs');


// --- NEW: helper to block # in filenames (defensive) ---
function assertNoHashes(basenames) {
    const offenders = basenames.filter(n => n.includes('#'));
    if (offenders.length) {
        const list = offenders.map(n => ` - ${n}`).join('\n');
        throw new Error(
            `Found filenames containing '#', aborting thumbnail generation:\n${list}\n` +
            `Rename these files so URLs map 1:1 to files.`
        );
    }
}

// --- NEW: prune stale thumbs that no longer have a source ---
async function pruneStaleThumbs(expectedSet) {
    const files = await fg('**/*.{jpg,jpeg,webp,avif}', {cwd: OUT_DIR, onlyFiles: true});
    let removed = 0;

    for (const rel of files) {
        // If a file is not expected from this run, remove it
        if (!expectedSet.has(rel)) {
            await fs.unlink(path.join(OUT_DIR, rel));
            removed++;
        }
    }
    if (removed > 0) {
        console.log(`🧹 Pruned ${removed} stale thumbnails from public/thumbs`);
    }
}

async function generate() {
    // Gather all input files by section
    const expected = new Set(); // relative paths inside OUT_DIR we create this run

    for (const section of SECTIONS) {
        const inSection = path.join(SRC_DIR, section);
        const outSection = path.join(OUT_DIR, section);

        // NEW: collect intrinsic sizes keyed by stem
        const metaByStem = {};

        const files = await fg(['**/*.{jpg,jpeg,png,tif,tiff,webp}'], {cwd: inSection, onlyFiles: true});

        await fs.mkdir(outSection, {recursive: true});

        for (const rel of files) {
            const srcAbs = path.join(inSection, rel);
            const base = path.basename(srcAbs);
            const ext = path.extname(base);
            const stem = base.slice(0, -ext.length);

            // NEW: read intrinsic dimensions once
            let metaW = null, metaH = null;
            try {
                const m = await sharp(srcAbs).metadata();
                metaW = m.width ?? null;
                metaH = m.height ?? null;
            } catch {
            }

            if (metaW && metaH) {
                metaByStem[stem] = {width: metaW, height: metaH};
            }
            for (const w of WIDTHS) {
                const pipeline = sharp(srcAbs).resize({width: w, withoutEnlargement: true});

                // JPG
                {
                    const relOut = path.join(section, `${stem}-w${w}.jpg`);
                    const outAbs = path.join(OUT_DIR, relOut);
                    expected.add(relOut);
                    try {
                        await fs.access(outAbs);
                    } catch {
                        await fs.mkdir(path.dirname(outAbs), {recursive: true});
                        await pipeline.clone().jpeg({quality: QUALITY_JPG, mozjpeg: true}).toFile(outAbs);
                    }
                }

                // WEBP
                {
                    const relOut = path.join(section, `${stem}-w${w}.webp`);
                    const outAbs = path.join(OUT_DIR, relOut);
                    expected.add(relOut);
                    try {
                        await fs.access(outAbs);
                    } catch {
                        await fs.mkdir(path.dirname(outAbs), {recursive: true});
                        await pipeline.clone().webp({quality: QUALITY_WEBP}).toFile(outAbs);
                    }
                }

                // AVIF
                {
                    const relOut = path.join(section, `${stem}-w${w}.avif`);
                    const outAbs = path.join(OUT_DIR, relOut);
                    expected.add(relOut);
                    try {
                        await fs.access(outAbs);
                    } catch {
                        await fs.mkdir(path.dirname(outAbs), {recursive: true});
                        await pipeline.clone().avif({quality: QUALITY_AVIF}).toFile(outAbs);
                    }
                }
            }
            // NEW: write _meta.json to src/data/thumbs/<section>/_meta.json
            const outMetaDir = path.join(DATA_THUMBS_DIR, section);
            await fs.mkdir(outMetaDir, { recursive: true });
            await fs.writeFile(
                path.join(outMetaDir, '_meta.json'),
                JSON.stringify(metaByStem, null, 2),
                'utf8'
            );
        }
    }

    // --- NEW: remove thumbs that no longer correspond to any source ---
    await pruneStaleThumbs(expected);
    console.log('✅ Thumbnails generated.');
}

generate().catch(e => {
    console.error(e);
    process.exit(1);
});
