// src/pages/search-index.json.ts
export const prerender = true;

import type { APIRoute } from 'astro';
import { getCollection, type DataEntryMap } from 'astro:content';

// Only collections that actually live in src/content/**
const COLLECTIONS = ['projects', 'sections'] as const satisfies readonly (keyof DataEntryMap)[];

// ---- utils ----
function stripHtml(md = '') {
    return md
        // remove YAML frontmatter
        .replace(/^---[\s\S]*?---\s*/m, ' ')
        // remove top-level import/export lines from MDX
        .replace(/^\s*import\s+[^;\n]+;?\s*$/gm, ' ')
        .replace(/^\s*export\s+[^;\n]+;?\s*$/gm, ' ')
        // remove code fences / inline code
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        // strip HTML tags and convert links to text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

// Try to infer a human title from YAML frontmatter "title:" or first H1
function inferTitle(raw: string, fallback: string) {
    const fm = raw.match(/^\s*title:\s*["']?(.+?)["']?\s*$/m);
    if (fm?.[1]) return fm[1].trim();
    const h1 = raw.match(/^\s*#\s+(.+?)\s*$/m);
    if (h1?.[1]) return h1[1].trim();
    return fallback;
}

// Derive route for /src/pages/**/*.md(x)
//  ../pages/about.mdx          -> /about
//  ../pages/privacy-policy.md  -> /privacy-policy
//  ../pages/index.md(x)        -> /
function pagesKeyToRoute(key: string): string {
    const k = key.replace(/\\/g, '/');
    let p = k.replace(/^.*\/pages\//, '');       // strip leading path to /pages
    // ignore any non-md(x) here by construction
    if (p.endsWith('/index.md') || p.endsWith('/index.mdx')) {
        p = p.replace(/\/index\.mdx?$/i, '');
        return '/' + p; // '' -> '/', 'docs' -> '/docs'
    }
    p = p.replace(/\.mdx?$/i, '');
    return '/' + p;
}

// Given an import.meta.glob key, infer listing route for images
function pathToRoute(key: string): string {
    const k = key.replace(/\\/g, '/');
    if (k.includes('/sections/')) {
        const name = k.split('/sections/')[1].replace(/\.json$/i, '');
        return `/${name}`;
    }
    if (k.includes('/collections/')) {
        const tail = k.split('/collections/')[1].replace(/\.json$/i, '');
        return `/${tail}`;
    }
    return '/';
}

// prefer `slug` (stable/URL-safe). fallback to `stem`.
const imageKey = (img: any) => (img?.slug || img?.stem || '').toLowerCase();

// Canonical detail URL for an image (prefer explicit `url`, else /section/slug)
const detailUrlFor = (img: any) =>
    img?.url ||
    (img?.section && (img?.slug || img?.stem) ? `/${img.section}/${(img.slug || img.stem)}` : '');

// ---- glob JSONs for images on listing pages ----
const sectionJsonMods = import.meta.glob('../data/sections/*.json', { eager: true }) as Record<string, any>;
const collectionJsonMods = import.meta.glob('../data/collections/*/*.json', { eager: true }) as Record<string, any>;

// ✅ NEW: glob .md/.mdx under /src/pages to index them as "pages"
const routedMdMods  = import.meta.glob('../pages/**/*.md',  { eager: true, as: 'raw' }) as Record<string, string>;
const routedMdxMods = import.meta.glob('../pages/**/*.mdx', { eager: true, as: 'raw' }) as Record<string, string>;

// Ignore specific /pages files from the index (e.g., search page itself)
const IGNORE_PAGE_PATHS = [
    '/search',        // your search results route
];
const IGNORE_SECTIONS = new Set<string>([
    // add basenames to ignore if needed, e.g. 'archive.json'
]);

export const GET: APIRoute = async () => {
    // 1) Content collections (MD/MDX) from src/content/**
    const contentItems: any[] = [];
    for (const name of COLLECTIONS) {
        const entries = await getCollection(name);
        for (const e of entries) {
            contentItems.push({
                type: name, // 'projects' | 'sections'
                title: e.data.title ?? e.slug,
                description: (e as any).data?.description ?? '',
                keywords: (e as any).data?.keywords ?? [],
                text: stripHtml((e as any).body ?? ''),
                url: `/${e.slug}`,
            });
        }
    }

    // 1b) Routed pages (src/pages/**/*.md / .mdx) as "pages"
    function pushRouted(rawMods: Record<string, string>) {
        for (const [k, raw] of Object.entries(rawMods)) {
            const url = pagesKeyToRoute(k);
            if (IGNORE_PAGE_PATHS.includes(url)) continue;
            const text = stripHtml(raw);
            const title = inferTitle(raw, url.replace(/\//g, ' ').trim() || 'Page');
            contentItems.push({
                type: 'pages',
                title,
                description: '',
                keywords: [],
                text,
                url,
            });
        }
    }
    pushRouted(routedMdMods);
    pushRouted(routedMdxMods);

    // 2) Images aggregated from all listing JSONs, with de-dup + "appearsOn"
    type ImgIndex = {
        type: 'image';
        title: string;
        description: string;
        keywords: string[];
        year: string | number | null;
        artist: string;
        section: string;
        slug?: string;
        stem?: string;
        thumb?: string;
        url: string;
        text: string;      // searchable blob
        appearsOn: string[];
    };

    const images = new Map<string, ImgIndex>();

    function addListingModule(modKey: string, modObj: any, allow = true) {
        const basename = modKey.split('/').pop() || '';
        if (!allow || IGNORE_SECTIONS.has(basename)) return;

        const data = (modObj as any).default ?? modObj;
        const list = Array.isArray(data) ? data : data.items ?? [];
        const route = pathToRoute(modKey);

        for (const img of list) {
            const key = imageKey(img);
            if (!key) continue;

            const artist = img?.exif?.artist || '';
            const description = img?.exif?.description || '';
            const keywords: string[] = Array.isArray(img?.exif?.keywords) ? img.exif.keywords : [];
            const year = img?.year ?? null;
            const section = img?.section ?? '';

            const canonicalUrl = detailUrlFor(img);

            if (!images.has(key)) {
                images.set(key, {
                    type: 'image',
                    title: img?.title || img?.stem || key,
                    description,
                    keywords,
                    year,
                    artist,
                    section,
                    slug: img?.slug,
                    stem: img?.stem,
                    thumb: img?.src, // first seen thumb OK; swap to preferred size if needed
                    url: canonicalUrl,
                    text: [img?.title, description, artist, keywords.join(' '), year, section]
                        .filter(Boolean)
                        .join(' ')
                        .slice(0, 8000),
                    appearsOn: [route],
                });
            } else {
                const existing = images.get(key)!;
                if (!existing.thumb && img?.src) existing.thumb = img.src;
                if (!existing.url && canonicalUrl) existing.url = canonicalUrl;
                if (!existing.section && section) existing.section = section;
                if (!existing.title && img?.title) existing.title = img.title;
                if (!existing.appearsOn.includes(route)) existing.appearsOn.push(route);
            }
        }
    }

    for (const [k, v] of Object.entries(sectionJsonMods))   addListingModule(k, v, true);
    for (const [k, v] of Object.entries(collectionJsonMods)) addListingModule(k, v, true);

    // 3) Final index
    const imageItems = Array.from(images.values());
    const index = [...contentItems, ...imageItems];

    return new Response(JSON.stringify(index), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, immutable',
        },
    });
};
