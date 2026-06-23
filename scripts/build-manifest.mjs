// scripts/build-manifest.mjs
import fg from 'fast-glob';
import {promises as fs} from 'fs';
import path from 'path';
import sharp from 'sharp';
import exifr from 'exifr';

const SECTIONS = ['applications', 'archive', 'drawings', 'installations', 'paintings', 'plein-air', 'prints'];
const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'images');            // originals
const OUT_DIR = path.join(ROOT, 'src', 'data');
const OUT_SECTIONS_DIR = path.join(OUT_DIR, 'sections');
const OUT_DETAILS_DIR = path.join(OUT_DIR, 'details');
const PUBLIC_DETAILS_DIR = path.join(ROOT, 'public', 'details');
const CONTENT_PAGES_DIR = path.join(ROOT, 'src', 'content', 'pages');

function stripLeadingDate(stem) {
    return stem.replace(/^\d{4}(?:[-_]\d{2}){0,2}[-_]?/, '');
}

function stripTrailingVariants(stem) {
    const pairedToken = '(?:[A-Z][_-]\\d+)';
    const token = `(?:${pairedToken}|[A-Z]|v\\d+|w\\d+|\\d{2,5}x\\d{2,5}|WEB|PRINT|FINAL|EDIT|DRAFT|PROOF|SMALL|LARGE)`;
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
        where: (img) => (img.exif?.artist || '').toLowerCase().includes('exolith series'),
    },
    {
        section: 'prints',
        slug: 'systems',
        title: 'systems',
        where: (img) => (img.exif?.artist || '').toLowerCase().includes('systems'),
    },
    {
        section: 'applications',
        slug: 'visual-synthesizer',
        title: 'Visual Synthesizer',
        where: (img) => (img.exif?.artist || '').toLowerCase().includes('visual synthesizer'),
    },
    {
        section: 'installations',
        slug: 'exhibition-space',
        title: 'Exhibition Space',
        where: (img) => (img.exif?.artist || '').toLowerCase().includes('exhibition space'),
    },
    {
        section: 'installations',
        slug: 'hypocenter',
        title: 'hypocenter',
        where: (img) => (img.exif?.artist || '').toLowerCase().includes('hypocenter'),
    },
];

function normalizeForMatch(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function collectionHaystack(item) {
    return normalizeForMatch([
        item.title,
        item.slug,
        item.stem,
        item.exif?.artist,
        item.exif?.description,
        ...(Array.isArray(item.exif?.keywords) ? item.exif.keywords : []),
    ].filter(Boolean).join(' '));
}

function collectionNeedles(section, slug, title) {
    const slugSegments = slug.split('/').filter(Boolean);
    const leafSlug = slugSegments.at(-1) || slug;

    return Array.from(new Set([
        normalizeForMatch(title),
        normalizeForMatch(slug),
        normalizeForMatch(slug.replace(/-/g, ' ')),
        normalizeForMatch(leafSlug),
        normalizeForMatch(leafSlug.replace(/-/g, ' ')),
        normalizeForMatch(`${section} ${slug}`),
    ].filter(Boolean)));
}

function frontmatterValue(raw, key) {
    const match = raw.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    if (!match) return '';

    return match[1]
        .replace(/^["']|["']$/g, '')
        .trim();
}

function frontmatterList(raw, key) {
    const block = raw.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, 'm'));
    if (block) {
        return block[1]
            .split('\n')
            .map((line) => line.match(/^\s+-\s+(.+?)\s*$/)?.[1])
            .filter(Boolean)
            .map((value) => value.replace(/^["']|["']$/g, '').trim());
    }

    const inline = frontmatterValue(raw, key);
    if (!inline) return [];

    return inline
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((value) => value.replace(/^["']|["']$/g, '').trim())
        .filter(Boolean);
}

function itemTokens(item) {
    return new Set([
        normalizeForMatch(item.stem),
        normalizeForMatch(item.slug),
        normalizeForMatch(item.title),
        normalizeForMatch(cleanTitleFromStem(item.stem)),
    ].filter(Boolean));
}

function itemMatchesToken(item, value) {
    const needle = normalizeForMatch(value);
    return needle ? itemTokens(item).has(needle) : false;
}

function isDefaultGalleryExcluded(item) {
    const titleTokens = normalizeForMatch(cleanTitleFromStem(item.stem)).split(' ').filter(Boolean);
    return titleTokens.at(-1) === 'icon';
}

async function discoverContentCollections() {
    const defs = [];

    for (const section of SECTIONS) {
        const sectionDir = path.join(CONTENT_PAGES_DIR, section);
        const files = await fg(['**/*.md', '**/*.mdx'], {cwd: sectionDir, onlyFiles: true});

        for (const file of files) {
            const contentPath = file
                .replace(/\\/g, '/')
                .replace(/\.mdx?$/i, '')
                .replace(/\/index$/i, '');
            if (!contentPath || contentPath === 'index') continue;

            const raw = await fs.readFile(path.join(sectionDir, file), 'utf8');
            const slug = contentPath;
            const title = frontmatterValue(raw, 'title') || cleanTitleFromStem(slug.split('/').at(-1) || slug);
            const needles = collectionNeedles(section, slug, title);
            const galleryInclude = frontmatterList(raw, 'galleryInclude');
            const galleryExclude = frontmatterList(raw, 'galleryExclude');

            defs.push({
                section,
                slug,
                title,
                where: (item) => {
                    const haystack = collectionHaystack(item);
                    const isIncluded = galleryInclude.some((value) => itemMatchesToken(item, value));
                    const isExcluded = galleryExclude.some((value) => itemMatchesToken(item, value));
                    if (isExcluded && !isIncluded) return false;
                    if (isDefaultGalleryExcluded(item) && !isIncluded) return false;
                    return isIncluded || needles.some((needle) => haystack.includes(needle));
                },
            });
        }
    }

    return defs;
}

function mergeCollectionDefs(...groups) {
    const byKey = new Map();

    for (const group of groups) {
        for (const def of group) {
            byKey.set(`${def.section}/${def.slug}`, def);
        }
    }

    return Array.from(byKey.values()).sort((a, b) =>
        a.section.localeCompare(b.section) ||
        a.title.localeCompare(b.title)
    );
}

async function parseMeta(filePath, section) {
    const base = path.basename(filePath);
    const ext = path.extname(base);
    const stem = base.slice(0, -ext.length);
    const fileStat = await fs.stat(filePath);
    const assetVersion = Math.floor(fileStat.mtimeMs);

    if (/[#/?\\ ]/.test(base)) {
        throw new Error(`Illegal character in filename: ${base} (section: ${section}).`);
    }

    let width = null, height = null;
    try {
        const meta = await sharp(filePath).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
    } catch {}

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
        originalHref: `/images/${section}/${base}?v=${assetVersion}`,
        stem, base, ext,
        thumbVersion: assetVersion,
        title, year, slug, width, height, ar, rows, dateKey,
        exif, sale
    };
}

function toListingItem(item) {
    const {
        section, stem, base, title, year, slug, width, height, ar, rows, sale, preferredHref, collection, thumbVersion
    } = item;
    return {
        section,
        stem,
        base,
        thumbVersion,
        title,
        year,
        slug,
        width,
        height,
        ar,
        rows,
        sale,
        preferredHref,
        collection
    };
}

function toDetailItem(item) {
    return {
        href: item.originalHref,
        artist: item.exif?.artist || '',
        description: item.exif?.description || '',
        keywords: Array.isArray(item.exif?.keywords) ? item.exif.keywords : [],
    };
}

/* ──────────────────────────────────────────────────────────────────────────────
   STEP 1 — Build a collection lookup and enrich items with linking metadata
   - Key by "<section>::<stem>" to avoid cross-section collisions.
   - Each mapped value: { slug, title, url } (no year here)
   - 'url' points to the collection page top: /<section>/<slug>/
   ──────────────────────────────────────────────────────────────────────────── */
function _key(section, stem) {
    return `${section}::${stem}`;
}

function buildCollectionIndex(defs, itemsBySection) {
    const map = new Map();
    for (const def of defs) {
        const { section, slug, title, where } = def;
        const pool = itemsBySection[section] || [];
        const items = pool.filter(where);
        for (const it of items) {
            map.set(_key(section, it.stem), {
                slug,
                title,
                url: `/${section}/${slug}/`, // ← collection page (no #anchor)
            });
        }
    }
    return map;
}


async function buildManifests() {
    await fs.mkdir(OUT_SECTIONS_DIR, {recursive: true});
    await fs.mkdir(OUT_DETAILS_DIR, {recursive: true});
    await fs.mkdir(PUBLIC_DETAILS_DIR, {recursive: true});
    const collectionDefs = mergeCollectionDefs(COLLECTIONS, await discoverContentCollections());

    // 1) Gather items for every section (no writes yet)
    const itemsBySection = {};
    for (const section of SECTIONS) {
        const pattern = path.join(SRC_DIR, section, '**/*.{jpg,jpeg,JPG,JPEG,png,PNG}');
        const files = await fg(pattern.replace(/\\/g, '/'));
        let items = await Promise.all(files.map(f => parseMeta(f, section)));
        // newest-first
        items.sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem));
        itemsBySection[section] = items;
    }

    // 2) Build collection index, then ENRICH items with preferred links + caption data
    const collIndex = buildCollectionIndex(collectionDefs, itemsBySection);

    for (const section of SECTIONS) {
        const items = itemsBySection[section].map(it => {
            const sectionHref = `/${section}/#${it.stem}`;       // safe fallback
            const collection = collIndex.get(_key(section, it.stem)) || null; // {slug,title,url}|null
            const preferredHref = collection?.url ?? sectionHref; // prefer collection page
            return {
                ...it,
                sectionHref,
                preferredHref,
                collection, // no year here
            };
        });
        itemsBySection[section] = items;
    }

    // 3) Write lean per-section JSON + detail manifests
    const sectionsIndex = [];
    for (const section of SECTIONS) {
        const items = itemsBySection[section];
        const listingItems = items.map(toListingItem);
        const detailItems = Object.fromEntries(items.map((item) => [item.stem, toDetailItem(item)]));
        await fs.writeFile(
            path.join(OUT_SECTIONS_DIR, `${section}.json`),
            JSON.stringify(listingItems, null, 2),
            'utf8'
        );
        const detailJson = JSON.stringify(detailItems, null, 2);
        await fs.writeFile(path.join(OUT_DETAILS_DIR, `${section}.json`), detailJson, 'utf8');
        await fs.writeFile(path.join(PUBLIC_DETAILS_DIR, `${section}.json`), detailJson, 'utf8');
        sectionsIndex.push({ section, count: items.length });
    }

    // 4) recent.json (top N across all, excluding certain sections)
    const EXCLUDE_RECENT = new Set(['applications', 'plein-air']);

    const all = Object.values(itemsBySection)
        .flat()
        .filter(item => !EXCLUDE_RECENT.has(item.section))
        .sort((a, b) =>
            b.dateKey.localeCompare(a.dateKey) ||
            b.stem.localeCompare(a.stem)
        )
        .map(toListingItem);

    const RECENT_COUNT = 50;
    await fs.writeFile(
        path.join(OUT_DIR, 'recent.json'),
        JSON.stringify(all.slice(0, RECENT_COUNT), null, 2),
        'utf8'
    );

    // 5) archive = archive + paintings + prints + plein-air + drawings + installations
    const archivePlus = [
        ...(itemsBySection['archive'] ?? []),
        ...(itemsBySection['paintings'] ?? []),
        ...(itemsBySection['prints'] ?? []),
        ...(itemsBySection['plein-air'] ?? []),
        ...(itemsBySection['drawings'] ?? []),
        ...(itemsBySection['installations'] ?? [])

    ].sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem))
        .map(toListingItem);

    await fs.writeFile(
        path.join(OUT_SECTIONS_DIR, 'archive.json'),
        JSON.stringify(archivePlus, null, 2),
        'utf8'
    );

    await fs.writeFile(
        path.join(OUT_DIR, 'sections.json'),
        JSON.stringify(sectionsIndex, null, 2),
        'utf8'
    );

    console.log('✅ Manifest built.');

    // 6) Write lean collections
    const OUT_COLLECTIONS_DIR = path.join(OUT_DIR, 'collections');

    async function buildCollections(itemsBySection) {
        const index = [];

        for (const def of collectionDefs) {
            const {section, slug, title, where} = def;
            const pool = itemsBySection[section] || [];
            const items = pool.filter(where)
                .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.stem.localeCompare(a.stem))
                .map(toListingItem);

            const outDir = path.join(OUT_COLLECTIONS_DIR, section);
            const outPath = path.join(outDir, `${slug}.json`);
            await fs.mkdir(path.dirname(outPath), {recursive: true});
            await fs.writeFile(outPath, JSON.stringify({section, slug, title, items}, null, 2), 'utf8');

            if (items.length === 0) {
                console.warn(`⚠️  No images matched ${section}/${slug}. Include "${normalizeForMatch(title) || slug}" in the image filename or metadata.`);
            }

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
