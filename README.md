# Astro Portfolio Template

A clean, rock‑solid Astro portfolio starter featuring:

- Simple config via `src/data/site.json`
- Three gallery styles (uniform grid, masonry + Lightbox, and deep‑link anchor grids)
- Zero server backend — easy to deploy on Cloudflare Pages
- Blazing fast even with loads of images LightHouse scores are 95>100
- Totally free custom website if you use CloudFlares free tier

[Live Demo](https://demo.bryanleister.com/)

---

## 1) Prerequisites (Mac setup from scratch)

If you’ve never done local web development before, don’t worry — here’s everything you need.

### Install Homebrew

Homebrew is a package manager for macOS. It makes installing developer tools much easier.

1. Open **Terminal** (press ⌘ + Space, type *Terminal*, hit Enter).
2. Paste this command and press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. When done, verify:

```bash
brew --version
```

### Install Node.js (and npm)

Now install Node.js using Homebrew:

```bash
brew install node
```

Then confirm both Node and npm work:

```bash
node -v
npm -v
```

You should see versions like `v20.x.x` or higher.

### Install Git (if not already installed)

```bash
brew install git
```

Check:

```bash
git --version
```

You’re now ready to build your site locally.

---

## 2) Quick Start (Local)

```bash
# 1) Clone the template
npx degit bryanrtboy/astro-template my-portfolio
cd my-portfolio

# 2) Install dependencies
npm install

# 3) Start the dev server
npm run dev
```

Open the printed local URL (usually `http://localhost:4321/` or `http://localhost:3000/`) and you should see the site.

---

## 3) Project Structure (high level)

```
my-portfolio/
├─ public/                  # Static assets copied as-is
├─ src/
│  ├─ components/           # Reusable Astro components
│  ├─ data/
│  │  └─ site.json          # ← your site settings (name, email, etc.)
│  ├─ layouts/              # Page layouts
│  ├─ pages/                # Route-based pages (/, /search, /archive, etc.)
│  ├─ styles/               # Global + component styles
│  └─ content/ (optional)   # If you add content collections
├─ thumbs/                  # Responsive thumbnails (if generated ahead of time)
├─ package.json
└─ astro.config.mjs
```

---

## 4) Configure Your Site — `src/data/site.json`

This file holds your basic info and site‑wide settings. Open it and update values like:

```json
{
  "title": "Your Name – Art & Design",
  "authorName": "Your Name",
  "email": "you@example.com",
  "description": "Portfolio of …",
  "url": "https://your-domain.com"
}
```

- **title**: Used in `<title>` and SEO
- **authorName / email**: Shown in components like the Lightbox footer/contact
- **description**: Site‑wide meta description
- **url**: Your production URL (helps with sitemap/SEO)

> After editing, restart `npm run dev` if the dev server doesn’t pick up changes.

---

## 5) The Three Grid Modes (How the galleries work)

### A) Archive – Uniform Grid
- A clean, even grid (all cards the same height) for quick scanning.
- Typically used on `/archive`.
- Best when you want visual consistency.

### B) Sections / Projects – Masonry Grid + Lightbox
- Masonry respects image aspect ratio for a lively wall‑of‑art.
- Clicking a card opens a **Lightbox** overlay with image details and next/prev.
- Good for section pages like `/paintings`, `/prints`, `/installations`.

### C) Home & Search – Deep‑Link “Anchor” Grid
- These use `#` anchors to **zoom into an image on its section page**.
- Example: Clicking a search result sends you to `/paintings#2024-08-20-mountain-study` and auto‑scrolls/highlights that work.
- Great for discovery: search and landing pages jump you straight to the piece in context.

> You’ll see the grid type selected by the page’s component: uniform vs masonry vs anchor grids.

---

## 6) Adding Your Work (where to put images)

- Place images under a consistent folder structure (e.g., `public/images/paintings/…`) *or* use the existing `thumbs/` convention.
- If the template includes a JSON manifest for a section (e.g., `src/data/paintings.json`), add a new entry following the shape:

```json
{
  "id": "2024-08-20-mountain-study",   
  "title": "Mountain Study",
  "year": 2024,
  "section": "paintings",
  "src": "/images/paintings/mountain-study.jpg",
  "alt": "Small mountain study in oil",
  "tags": ["oil", "landscape"],
  "width": 1600,
  "height": 1200
}
```

- `id` should be unique (used by the `#anchor` deep‑link).
- `year` enables sorting by most‑recent first in some views.
- `src` should point to the image path you’ve added.

> After adding items, refresh the page. Some grids (search) may also rely on a generated `search-index.json` which is included in this template’s build steps.

---

## 7) Git: Save Your Work & Push to GitHub

```bash
# Initialize a repo (if you didn’t fork)
git init

git add -A
git commit -m "Initial commit: Astro portfolio template"

# Create a new GitHub repo, then connect your local repo
# Replace the URL with your GitHub repo’s URL
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

> If your default branch is `master`, use that instead of `main`.

---

## 8) Deploy to Cloudflare Pages

1. Log in to Cloudflare and go to **Pages** → **Create a project**.
2. **Connect to Git** and select your GitHub repo.
3. **Build settings** (defaults are usually perfect for Astro):
    - **Framework preset**: Astro (or “None” if you don’t see it)
    - **Build command**: `npm run build`
    - **Build output directory**: `dist`
    - **Node version**: 18+ (Cloudflare manages this)
4. Click **Save and Deploy**.
5. Cloudflare will build and give you a live URL. Later you can add a custom domain.

> For a static Astro site, no environment variables are required.

---

## 9) Commands Reference

```bash
npm run dev      # Start local dev server
npm run build    # Build production site into /dist
npm run preview  # Preview the production build locally
```

---

## 10) Troubleshooting

- **Dev server shows a blank page**: Check the terminal for errors; confirm Node 18+.
- **Images not appearing**: Verify file paths (e.g., `/images/...`) and JSON manifests.
- **Anchors not scrolling/highlighting**: Ensure each item has a unique `id` and you’re linking like `/section#that-id`.
- **Search not finding items**: Rebuild the search index by stopping/starting dev or running a fresh `npm run build`.
- **Cloudflare build fails**: Make sure lockfile and `package.json` are pushed; confirm build command/output folder.

---

## 11) Customize Styles & Components

- Global CSS in `src/styles/` and utility classes in components.
- Header/footer live in `src/components/` and layout in `src/layouts/`.
- Feel free to rename sections (paintings, prints, installations) to fit your practice.

---

## 12) License & Attribution

- Use this template freely for your own site. A link back is appreciated but not required.

---

**Happy building!** If you run into issues, open a GitHub issue on this repo with a short description, steps to reproduce, and screenshots if possible.

