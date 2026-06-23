# AGENTS.md

Guidance for coding agents working in this Astro portfolio template.

## Project Scope

This repo is the reusable baseline for static Astro portfolio sites that use folder-based content pages, generated image galleries, client-side search, and Cloudflare Pages deployment.

Keep this repo generic. Do not copy site-specific content, branding, originals, or generated gallery data from a deployment repo unless the user explicitly asks.

## Tech Stack

- Astro 6 static site
- MDX for component-driven pages
- Sharp-based responsive thumbnail generation
- Generated JSON for galleries, collections, image details, recent work, and search
- Cloudflare Pages static deployment

Use Node 22.12+ locally and on Cloudflare Pages.

## Core Commands

```bash
npm install
npm run prep
npm run dev
npm run build
npm run preview
```

`npm run prep` mirrors `images/` to `public/images/`, generates responsive thumbs in `public/thumbs/`, and regenerates JSON under `src/data/` and `public/details/`.

## Content And Images

- Content pages live in `src/content/pages/`.
- Originals live in `images/<section>/`.
- Generated files under `public/images/`, `public/thumbs/`, `public/details/`, and `src/data/` should normally be regenerated, not hand-edited.
- Use `excerpt` as the page summary field.

## Shared Engine Behavior

This template is intended to receive shared fixes from active deployment repos, then pass those fixes to other deployments.

Preserve these behaviors:

- `src/content.config.ts` uses Astro Content Layer `glob()`.
- `src/pages/[...slug].astro` renders content entries with `render(page)`.
- Thumbnail generation rewrites files when the source image is newer.
- Image URLs include `?v=<source-mtime>` via `thumbVersion` so long-cache Cloudflare/browser assets refresh after same-filename replacements.
- The clicked gallery lightbox uses large responsive `/thumbs/...` images, not only the original `/images/...` file.

## Cloudflare Pages

Recommended settings:

```text
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Node version / NODE_VERSION: 22.12 or newer
```

`public/_headers` keeps HTML revalidated and image/thumb assets long cached. On Cloudflare Pages, `CF_PAGES` causes thumb generation to skip, so generated thumbs and JSON should be committed before deploy.

## Guardrails

- Keep the template generic.
- Do not overwrite deployment-specific `src/data/site.json`, content pages, images, or README text when syncing outward.
- Do not add dependencies unless needed for shared engine behavior.
- Run `npm run build` after shared engine changes.
