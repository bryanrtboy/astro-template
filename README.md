# Astro Portfolio Template

A clean Astro portfolio template for artwork, project pages, image galleries, search, and responsive thumbnails.

The content model is folder-based:

- Pages live in `src/content/pages/`.
- The filesystem determines routes and parent/child relationships.
- Image gallery data is generated from files in `images/`.
- Page summaries use one frontmatter field: `excerpt`.

Live demo: https://demo.bryanleister.com/

---

## Quick Start

```bash
npx degit bryanrtboy/astro-template my-portfolio
cd my-portfolio
npm install
npm run dev
```

Open the local URL printed by Astro, usually `http://localhost:4321/`.

Production build:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

---

## Project Structure

```text
my-portfolio/
├─ images/                   # Source/original images, organized by section
│  ├─ applications/
│  ├─ archive/
│  ├─ installations/
│  ├─ paintings/
│  ├─ prints/
│  └─ site/
├─ public/
│  ├─ images/                # Synced originals used by the live site
│  ├─ thumbs/                # Generated responsive thumbnails
│  └─ details/               # Public image detail JSON
├─ scripts/
│  ├─ sync-images.sh         # Mirrors images/ to public/images/
│  ├─ gen-thumbs.mjs         # Generates responsive JPG/WebP/AVIF thumbs
│  └─ build-manifest.mjs     # Generates gallery, detail, and collection JSON
└─ src/
   ├─ components/            # Reusable Astro components
   ├─ content/
   │  └─ pages/              # Markdown/MDX site pages
   ├─ data/
   │  ├─ site.json           # Site name, nav, email, footer links
   │  ├─ sections/           # Generated section gallery JSON
   │  ├─ collections/        # Generated child/project gallery JSON
   │  ├─ details/            # Generated image detail JSON
   │  └─ thumbs/             # Generated intrinsic image metadata
   ├─ layouts/
   ├─ lib/
   ├─ pages/                 # Astro routes, search, home, 404
   └─ styles/
```

---

## Site Settings And Navigation

Edit site-wide metadata and navigation in:

```text
src/data/site.json
```

This controls the site name, description, contact emails, header navigation, and footer links.

If you add a new top-level section and want it in the header, add it to `site.nav`.

---

## Page Structure

Content pages live in `src/content/pages/`. Folders create routes and hierarchy.

Examples:

```text
src/content/pages/about.md
src/content/pages/installations/index.md
src/content/pages/installations/exhibition-space.mdx
src/content/pages/applications/index.md
src/content/pages/applications/visual-synthesizer.mdx
src/content/pages/prints/systems.mdx
```

These become:

```text
/about/
/installations/
/installations/exhibition-space/
/applications/
/applications/visual-synthesizer/
/prints/systems/
```

Parent pages use `index.md` or `index.mdx` inside a folder. Child pages are sibling files in that folder.

The site automatically:

- Builds breadcrumbs from the folder path.
- Shows direct child pages as image cards.
- Uses each child page's `excerpt` for hover text.
- Hides the broad image gallery underneath when child page cards exist.

---

## Frontmatter

Use a small, consistent frontmatter shape:

```yaml
---
title: Page Title
excerpt: A short description of this page for SEO, search, and child-page cards.
---
```

Optional fields:

```yaml
gallery: true
showInParent: false
menuOrder: 10
keywords:
  - example
  - search term
```

- `title`: Page heading, browser title, and search title.
- `excerpt`: The single source of truth for page summary text.
- `gallery: true`: Shows the generated gallery for this page's route, such as `/paintings/` or `/archive/`.
- `showInParent: false`: Hides a child page from its parent page's card grid.
- `menuOrder`: Sorts child pages before falling back to title sorting.
- `keywords`: Adds extra search terms for page search.

Avoid adding separate `description` or `subtitle` fields for content pages. Use `excerpt`.

---

## Markdown vs MDX

Use `.md` by default.

Use `.mdx` only when the page needs Astro/JSX components or JSX-style markup.

Good `.md` example:

```md
---
title: About
excerpt: Biography, artist statement, links, and background for the portfolio owner.
---

![Portrait of Your Name](/images/site/profile.jpg)

## Links

- [Resume](/resume/)
- [Applications](/applications/)
```

Use `.mdx` for component-driven pages:

```mdx
---
title: Example Video Project
excerpt: A short project summary for SEO, search, and cards.
---
import HlsVideo from '../../../components/HlsVideo.astro';

<HlsVideo
  src="https://video.example.com/project/master.m3u8"
  poster="https://video.example.com/project/poster.jpg"
/>
```

`resume.mdx` intentionally keeps a raw HTML table because the resume is tabular content.

---

## Galleries And Images

Put original images in `images/<section>/`.

The starter sections are:

```text
applications
archive
installations
paintings
prints
site
```

Optional generated sections are already supported by the scripts:

```text
drawings
plein-air
```

The build pipeline runs automatically before `dev` and `build`:

```bash
npm run prep
```

That command:

1. Mirrors `images/` into `public/images/`.
2. Generates responsive thumbnails in `public/thumbs/`.
3. Generates gallery JSON under `src/data/sections/`.
4. Generates project/collection JSON under `src/data/collections/`.
5. Generates image details under `src/data/details/` and `public/details/`.

You normally do not edit generated JSON by hand.

### Section Galleries

A page like `src/content/pages/paintings/index.md` can show a generated gallery:

```yaml
---
title: Paintings
excerpt: Paintings and related studio work.
gallery: true
---
```

This uses `src/data/sections/paintings.json`, generated from `images/paintings/`.

### Project / Child Galleries

Project pages like `/installations/exhibition-space/` can show a generated project gallery when matching collection data exists in:

```text
src/data/collections/installations/exhibition-space.json
```

Those collection files are generated by `scripts/build-manifest.mjs` from image metadata and collection rules.

---

## Search

Search is fully static and client-side.

- `/search-index.json` is generated at build time from content pages and image manifests.
- `/search/` loads the JSON and searches with Fuse.
- Image results deep-link back to their section anchors, such as `/paintings/#image-stem`.

---

## Deploy To Cloudflare Pages

1. Push your site to GitHub.
2. In Cloudflare Pages, create a project and connect the repo.
3. Use these build settings:

```text
Framework preset: Astro
Build command: npm run build
Build output directory: dist
```

No environment variables are required for the static template.
