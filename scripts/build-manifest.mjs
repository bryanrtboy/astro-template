// scripts/build-manifest.mjs
import fg from 'fast-glob';
import {promises as fs} from 'fs';
import path from 'path';
import sharp from 'sharp';
import exifr from 'exifr';

const SECTIONS = ['applications', 'archive', 'installations', 'paintings','prints'];
const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'images');            // originals
const OUT_DIR = path.join(ROOT, 'src', 'data');
const OUT_SECTIONS_DIR = path.join(OUT_DIR, 'sections');


function stripLeadingDate(stem) {
    return stem.replace(/^\d{4}(?:[-_]\d{2}){0,2}[-_]?/, '');
}

function stripTrailingVariants(stem) {
    const token = '(?:[A-Z]|v\\d+|\\d+|w\\d+|\\d{2,5}x\\d{2,5}|WEB|PRINT|FINAL|EDIT|DRAFT|PROOF|SMALL|LARGE)';
    const SUFFIX = new RegExp(`(?:[_-]${token})+$`, 'i');
    let s = stem;
    while (SUFFIX.test(s)) s = s.replace(SUFFIX, '');
    return s;
}

function tidySpaces(s) {
    return s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanTitleFromStem(stem) {
    return tidySpaces(stripTrailingVariants(stripLeadingDate(stem)));
}

function makeDateKey(stem) {
    const m = stem.match(/^(\d{4})(?:[-_](\d{2}))?(?:[-_](\d{2}))?/);
    if (!m) return '0000-00-00';
    const yyyy = m[1], mm = m[2] ?? '00', dd = m[3] ?? '00';
    return `${yyyy}-${mm}-${dd}`;
}

// Build "project" collections from existing items
// Each record produces: src/data/collections/<section>/<slug>.json
const COLLECTIONS = [
    {
        section: 'prints',
        slug: 'exolith-series',
        title: 'exolith series',
        where: (item) =>
            (item.exif?.artist || '').toLowerCase().includes('exolith series')
    },
    {
        section: 'prints',
        slug: 'systems',
        title: 'systems',
        // case-insensitive match against EXIF artist (you can add more rules below)
        where: (item) =>
            (item.exif?.artist || '').toLowerCase().includes('systems')
    },
    {
        section: 'applications',
        slug: 'visual-synthesizer',
        title: 'Visual Synthesizer',
        // case-insensitive match against EXIF artist (you can add more rules below)
        where: (item) =>
            (item.exif?.artist || '').toLowerCase().includes('visual synthesizer')
    },
    {
        section: 'installations',
        slug: 'exhibition-space',
        title: 'Exhibition Space',
        // case-insensitive match against EXIF artist (you can add more rules below)
        where: (item) =>
            (item.exif?.artist || '').toLowerCase().includes('exhibition space')
    },
    {
        section: 'installations',
        slug: 'hypocenter',
        title: 'hypocenter',
        // case-insensitive match against EXIF artist (you can add more rules below)
        where: (item) =>
            (item.exif?.artist || '').toLowerCase().includes('hypocenter')
    }
];

async function parseMeta(filePath, section) {
    const base = path.basename(filePath);
    const ext = path.extname(base);
    const stem = base.slice(0, -ext.length);

    if (/[#/?\\ ]/.test(base)) {
        throw new Error(`Illegal character in filename: ${base} (section: ${section}).`);
    }


    let width = null, height = null;
    try {
        const meta = await sharp(filePath).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
    } catch {
    }

    const ar = (width && height) ? +(height / width).toFixed(6) : null;
    const yearMatch = stem.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';
    const title = cleanTitleFromStem(stem);
    const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const ROW_UNIT = 10, BASE_COL_W = 240;
    const rows = ar ? Math.max(1, Math.ceil(ar * (BASE_COL_W / ROW_UNIT))) : 1;

    const dateKey = makeDateKey(stem);

    let exif = {};
    try {
        const raw = await exifr.parse(filePath, {
            tiff: true, ifd0: true, exif: true, iptc: true, xmp: true
        }) || {};
        const artist = raw.Artist || raw.Creator || raw.Credit || '';
        const description =
            raw.ImageDescription || raw.Description || raw.Caption || raw.ObjectName || '';
        const copyright = raw.Copyright || '';
        const keywords = Array.isArray(raw.Keywords) ? raw.Keywords
            : raw.Keywords ? [raw.Keywords] : (raw.Subject || []);
        exif = {artist, description, copyright, keywords};
    } catch (e) {
        exif = {};
    }

    //  "_A" → contact Bryan; "_W" → contact Walker; else private
    let sale = 'PRIVATE';
    if (/_A(?:_|$)/i.test(stem)) sale = 'A';
    else if (/_W(?:_|$)/i.test(stem)) sale = 'W';

    return {
        section,
        src: `/images/${section}/${base}`,
        href: `/images/${section}/${base}`, // you can also use encodeURIComponent(base) if you prefer
        stem, base, ext,
        title, year, slug, width, height, ar, rows, dateKey,
        exif, sale
    };

}

async function buildManifests() {
    await fs.mkdir(OUT_SECTIONS_DIR, {recursive: true});
    const index = [];
    const itemsBySection = {};

    for (const section of SECTIONS) {
        const pattern = path.join(SRC_DIR, section, '**/*.{jpg,jpeg,JPG,JPEG,png,PNG}');
        const files = await fg(pattern.replace(/\\/g, '/'));
        let items = await Promise.all(files.map(f => parseMeta(f, section)));

        // newest-first
        items.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem));
        itemsBySection[section] = items;

        await fs.writeFile(path.join(OUT_SECTIONS_DIR, `${section}.json`), JSON.stringify(items, null, 2), 'utf8');
        index.push({section, count: items.length});
    }

    // recent.json (top 20 across all, excluding certain sections)
    const EXCLUDE_RECENT = new Set(['applications', 'plein-air']);

    const all = Object.values(itemsBySection)
        .flat()
        .filter(item => !EXCLUDE_RECENT.has(item.section))  // 👈 skip these sections
        .sort((a, b) =>
            b.dateKey.localeCompare(a.dateKey) ||
            b.stem.localeCompare(a.stem)
        );

// adjust count if you want fewer/more
    const RECENT_COUNT = 50;

    await fs.writeFile(
        path.join(OUT_DIR, 'recent.json'),
        JSON.stringify(all.slice(0, RECENT_COUNT), null, 2),
        'utf8'
    );

    // archive = archive + paintings
    const archivePlus = [
        ...(itemsBySection['archive'] ?? []),
        ...(itemsBySection['paintings'] ?? []),
        ...(itemsBySection['prints'] ?? []),
        ...(itemsBySection['plein-air'] ?? []),
        ...(itemsBySection['drawings'] ?? []),
        ...(itemsBySection['installations'] ?? [])

    ].sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem));
    await fs.writeFile(path.join(OUT_SECTIONS_DIR, 'archive.json'), JSON.stringify(archivePlus, null, 2), 'utf8');

    await fs.writeFile(path.join(OUT_DIR, 'sections.json'), JSON.stringify(index, null, 2), 'utf8');
    console.log('✅ Manifest built.');

    const OUT_COLLECTIONS_DIR = path.join(OUT_DIR, 'collections');

    async function buildCollections(itemsBySection) {
        const index = [];

        for (const def of COLLECTIONS) {
            const {section, slug, title, where} = def;
            const pool = itemsBySection[section] || [];
            const items = pool.filter(where)
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem));

            const outDir = path.join(OUT_COLLECTIONS_DIR, section);
            const outPath = path.join(outDir, `${slug}.json`);
            await fs.mkdir(outDir, {recursive: true});
            await fs.writeFile(outPath, JSON.stringify({section, slug, title, items}, null, 2), 'utf8');

            index.push({section, slug, title, count: items.length});
        }

        await fs.writeFile(path.join(OUT_COLLECTIONS_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
        console.log('✅ Collections built.');
    }

    await buildCollections(itemsBySection);
}


buildManifests().catch(e => {
    console.error(e);
    process.exit(1);
});


