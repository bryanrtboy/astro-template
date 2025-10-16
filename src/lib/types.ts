export type GalleryItem = {
    section: string;
    src: string;          // raw path
    href?: string;        // encoded path
    stem: string;
    base?: string;
    ext?: string;
    title: string;
    year?: string;
    slug: string;
    width?: number;
    height?: number;
    ar?: number;
    rows?: number;
    dateKey?: string;
    exif?: {
        artist?: string;
        description?: string;
        copyright?: string;
        keywords?: string[];
    };
    sale?: 'A' | 'W' | 'PRIVATE';
};

// Many of your listing JSON files are either [{...}, {...}] or { items: [...] }
export type GalleryFile =
    | GalleryItem[]
    | { items: GalleryItem[] };

// ---- Search index document shapes ----

// Content docs (MD/MDX via astro:content)
export type SearchPageDoc = {
    type: 'projects' | 'sections' | 'pages'; // add/remove keys to match your content config
    title: string;
    url: string;            // where to navigate
    text: string;           // stripped body used for search
    keywords?: string[];
    description?: string;
};

// Image docs (flattened from GalleryItem for search)
export type SearchImageDoc = {
    type: 'image';
    title: string;
    url: string;            // canonical detail route (e.g., /paintings/slug)
    text: string;           // title/desc/keywords/year blob
    keywords: string[];
    year?: string | number | null;
    artist?: string;
    section?: string;
    slug?: string;
    thumb?: string;         // representative thumbnail (e.g., src)
    appearsOn: string[];    // all listing routes where it appears (/prints, /archive, etc.)
};

// Union for the JSON index
export type SearchDoc = SearchPageDoc | SearchImageDoc;

// ---- Tiny helpers (optional) ----
export const galleryKey = (g: Pick<GalleryItem, 'slug' | 'stem'>) =>
    (g.slug || g.stem || '').toLowerCase();

export const isSearchImageDoc = (d: SearchDoc): d is SearchImageDoc =>
    d.type === 'image';
