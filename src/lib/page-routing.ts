import type { CollectionEntry } from 'astro:content';

export type PageEntry = CollectionEntry<'pages'>;

export function normalizePagePath(path: string) {
    return path.endsWith('/') ? path : `${path}/`;
}

export function pagePath(entry: PageEntry) {
    if (entry.id === 'home.md' || entry.id === 'home.mdx' || entry.data.wpSlug === 'home') return '/';

    const contentPath = entry.id
        .replace(/\.(md|mdx)$/i, '')
        .replace(/\/index$/i, '');

    return contentPath ? normalizePagePath(`/${contentPath}`) : '/';
}

export function displayTitle(title: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(title)) return title;

    const smallWords = new Set(['and', 'as', 'at', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);

    return title
        .split('-')
        .filter(Boolean)
        .map((word, index) => {
            const upperWord = word.toUpperCase();
            if (['AR', 'BFA', 'CV', 'DAM', 'UX', 'VR'].includes(upperWord)) return upperWord;
            if (index > 0 && smallWords.has(word.toLowerCase())) return word.toLowerCase();
            return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
        })
        .join(' ');
}

export function comparePages(a: PageEntry, b: PageEntry) {
    return (a.data.menuOrder ?? 0) - (b.data.menuOrder ?? 0)
        || displayTitle(a.data.title).localeCompare(displayTitle(b.data.title));
}

export function isDirectFolderChild(entry: PageEntry, parentPath: string) {
    const childPath = pagePath(entry);
    const normalizedParent = normalizePagePath(parentPath);
    if (childPath === normalizedParent || !childPath.startsWith(normalizedParent)) return false;

    const remainder = childPath.slice(normalizedParent.length).replace(/\/$/, '');
    return remainder.length > 0 && !remainder.includes('/');
}
