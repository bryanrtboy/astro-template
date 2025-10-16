// src/scripts/search-client.js
import Fuse from 'fuse.js';


(async () => {
    const qs   = new URLSearchParams(window.location.search);
    const q    = (qs.get('q') || '').trim();
    const per  = Math.max(1, Math.min(96, Number(qs.get('per') || '48')));
    let page   = Math.max(1, Number(qs.get('page') || '1'));

    const metaEl   = document.getElementById('search-meta');
    const pagesSec = document.getElementById('results-pages');          
    const pagesUl       = pagesSec.querySelector('.page-list');         
    const imgsSec  = document.getElementById('results-images');           
    const gridEl   = document.getElementById('image-grid');               
    const pager         = imgsSec.querySelector('.pager');          
    const prevBtn  = document.getElementById('prevPage');           
    const nextBtn  = document.getElementById('nextPage');          
    const pageInfo = document.getElementById('pageInfo');            
    const emptyEl  = document.getElementById('empty-state');     
    
document.title = q ? `Search: ${q}` : 'Search results';

        if (!q) {
            metaEl.hidden = true; pagesSec.hidden = true; imgsSec.hidden = true; emptyEl.hidden = false; return;
        }
        emptyEl.hidden = true;

        // Load index
        let index = [];
        try {
            const res = await fetch('/search-index.json', { cache: 'no-cache' });
            if (res.ok) index = await res.json();
        } catch (e) { console.error('Failed to load search-index.json', e); }

        // Build plural-aware whole-word regex, e.g. raven|ravens
        const qEsc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactPattern = new RegExp(`\\b${qEsc}(?:s|es)?\\b`, 'i');

        // Exact/whole-word first
        const exactHits = index.filter(item =>
            exactPattern.test(item.title || '') ||
            exactPattern.test(item.description || '') ||
            exactPattern.test(item.text || '') ||
            (Array.isArray(item.keywords) && item.keywords.some(k => exactPattern.test(k)))
        );

        // --- collect & merge instead of short-circuiting ---
        let hits = [];
        const seen = new Map();                 // id -> merged { item, matches, score, sources:Set }
        const idOf = (x) => x.item?.url || x.item?.id || x.url || x.id || x.path || x.title;

// Stage A — whole-word (plural-aware) exact (you already have `exactHits`)
        if (exactHits?.length) {
            exactHits.forEach(item => {
                const id = idOf(item);
                if (!seen.has(id)) {
                    seen.set(id, { item, matches: [], score: 100, sources: new Set(['exact']) });
                }
            });
        }

// Stage B — literal substring (so "bird" matches "birdy", "house" matches "henhouse")
        const substrPattern = new RegExp(qEsc, 'i');
        const substrHits = index.filter(item => {
            const title = item.title || '';
            const desc  = item.description || '';
            const text  = item.text || '';
            const keys  = Array.isArray(item.keywords) ? item.keywords.join(' ') : '';
            return (
                substrPattern.test(title) ||
                substrPattern.test(desc)  ||
                substrPattern.test(text)  ||
                substrPattern.test(keys)
            );
        });

        substrHits.forEach((item, idx) => {
            const id = idOf(item);
            if (!seen.has(id)) {
                // slight order bonus to earlier items to stabilize sort consistency
                seen.set(id, { item, matches: [], score: 70 - idx * 0.01, sources: new Set(['substr']) });
            } else {
                seen.get(id).sources.add('substr');
            }
        });

// Stage C — fuzzy (only for >=4 char queries; keep it fairly strict)
        let fuzzyResults = [];
        if (q.length >= 4) {
            const fuseBase = {
                includeMatches: true,
                includeScore: true,
                minMatchCharLength: Math.max(4, Math.min(q.length, 8)),
                ignoreLocation: true,
                // you used useExtendedSearch; only needed if you pass Fuse's special syntax.
                useExtendedSearch: false,
                keys: [
                    { name: 'title',    weight: 0.6 },
                    { name: 'text',     weight: 0.4 },
                    { name: 'keywords', weight: 0.3 },
                ],
            };
            const fuse = new Fuse(index, { ...fuseBase, threshold: 0.28, distance: 80, findAllMatches: false });

            // post-filter: require a decent contiguous span in the *best* match
            const MIN_CONTIG = Math.max(3, Math.ceil(q.length * 0.6));
            fuzzyResults = fuse.search(q).filter(h => {
                const mm = (h.matches || []).find(m => ['title','text','keywords'].includes(m.key));
                if (!mm || !mm.indices?.length) return false;
                const [s0, e0] = mm.indices[0];
                const matchLen = e0 - s0 + 1;
                const scoreOK = (typeof h.score === 'number') ? h.score <= 0.4 : true;
                return matchLen >= MIN_CONTIG && scoreOK;
            });

            // merge fuzzy
            fuzzyResults.forEach((h, idx) => {
                const item = h.item;
                const id = idOf(item);
                const entry = seen.get(id);
                const baseScore = 50 - idx * 0.01;                     // below substr
                const add = () => seen.set(id, { item, matches: h.matches || [], score: baseScore, sources: new Set(['fuzzy']) });

                if (!entry) {
                    add();
                } else {
                    entry.sources.add('fuzzy');
                    // keep best score and keep matches if we had none
                    entry.score = Math.max(entry.score, baseScore);
                    if (!entry.matches?.length && h.matches?.length) entry.matches = h.matches;
                }
            });
        }

// finalize order: exact > substr > fuzzy, then by score desc, then by title asc
        const merged = Array.from(seen.values());
        const tier = (s) => s.has('exact') ? 0 : s.has('substr') ? 1 : 2;

        merged.sort((a, b) => {
            const ta = tier(a.sources), tb = tier(b.sources);
            if (ta !== tb) return ta - tb;

            // newest year first — undefined years treated as 0
            const ya = parseInt(a.item.year) || 0;
            const yb = parseInt(b.item.year) || 0;
            if (ya !== yb) return yb - ya;

            // within same year, higher score first
            if (b.score !== a.score) return b.score - a.score;

            // then alphabetical title
            const at = (a.item.title || '').toLowerCase();
            const bt = (b.item.title || '').toLowerCase();
            return at.localeCompare(bt);
        });

// what the rest of your code expects:
        hits = merged;
        const results = hits.map(h => ({ ...h.item, _matches: h.matches || [] }));


        // Split
        const imageResults = results.filter(r => r.type === 'image');
        const pageResults  = results.filter(r => r.type !== 'image');

        metaEl.textContent = `${results.length} result${results.length === 1 ? '' : 's'} for “${q}”`;
        metaEl.hidden = false;

        // ---------- helpers ----------
        function textFields(item) {
            return {
                title: (item.title || ''),
                description: (item.description || ''),
                text: (item.text || ''),
                keywords: Array.isArray(item.keywords) ? item.keywords.join(' ') : ''
            };
        }

        function highlightTitle(title) {
            if (!title) return '';
            const re = new RegExp(`(${qEsc})(?:s|es)?`, 'ig');
            return title.replace(re, '<mark>$1</mark>');
        }

        function makeSnippet(item, matches) {
            const { title, description, text } = textFields(item);
            const haystacks = [
                { key: 'text',        s: text },
                { key: 'description', s: description },
                { key: 'title',       s: title }
            ];

            // Whole-word window first
            for (const { s } of haystacks) {
                if (!s) continue;
                const found = s.search(exactPattern);
                if (found >= 0) {
                    const start = Math.max(0, found - 60);
                    const end   = Math.min(s.length, found + q.length + 60);
                    const chunk = s.slice(start, end);
                    const re = new RegExp(`(${qEsc})(?:s|es)?`, 'ig');
                    return (start>0?'…':'') + chunk.replace(re, '<mark>$1</mark>') + (end<s.length?'…':'');
                }
            }

            // after the whole-word loop, add this:
            for (const { s } of haystacks) {
                if (!s) continue;
                const i = s.toLowerCase().indexOf(q.toLowerCase());
                if (i >= 0) {
                    const start = Math.max(0, i - 60);
                    const end   = Math.min(s.length, i + q.length + 60);
                    const chunk = s.slice(start, end);
                    const re = new RegExp(`(${qEsc})`, 'ig');
                    return (start>0?'…':'') + chunk.replace(re, '<mark>$1</mark>') + (end<s.length?'…':'');
                }
            }

            // Fallback to first fuse match if present
            if (matches && matches.length) {
                const mm = matches.find(m => ['text','description','title'].includes(m.key)) || matches[0];
                const s = textFields(item)[mm.key] || '';
                if (s && mm.indices && mm.indices.length) {
                    const [s0, e0] = mm.indices[0];
                    const start = Math.max(0, s0 - 60);
                    const end   = Math.min(s.length, e0 + 60);
                    const chunk = s.slice(start, end);
                    const matchStr = s.slice(s0, e0 + 1);
                    return (start>0?'…':'') + chunk.replace(matchStr, `<mark>${matchStr}</mark>`) + (end<s.length?'…':'');
                }
            }
            return '';
        }

        // prefer "paintings" first, shove anything with "archive" to the end
        function appearsPriority(p) {
            const s = (p || '').toLowerCase();
            if (s.includes('/archive')) return 99;
            if (s.startsWith('/paintings')) return 0;
            return 10;
        }
        function sortAppearsOn(list) {
            const uniq = Array.from(new Set(list || []));
            return uniq.sort((a, b) => appearsPriority(a) - appearsPriority(b));
        }

        // ---------- responsive image helpers (match GalleryImage.astro) ----------
        function stemSafeFrom(item) {
            return (item.stemFileSafe || item.stem || item.slug || '').toString();
        }
        const searchWidths = [320, 480, 720, 960];
        const searchSizes = [
            '(max-width: 520px) calc(100vw - 2.5rem)',
            '(max-width: 900px) calc((100vw - 2.5rem - 10px) / 2)',
            '(max-width: 1151px) calc((min(100vw, 1200px) - 2.5rem - 3*10px) / 4)',
            '(max-width: 1200px) calc((min(100vw, 1200px) - 2.5rem - 4*10px) / 5)',
            'calc((min(100vw, 1200px) - 2.5rem - 4*10px) / 5)',
        ].join(', ');
        function srcsetFor(item, ext) {
            const section = (item.section || '').toString();
            const stem = stemSafeFrom(item);
            return searchWidths.map(w => `/thumbs/${section}/${stem}-w${w}.${ext} ${w}w`).join(', ');
        }
        function pictureHTML(item, priority) {
            const section = (item.section || '').toString();
            const stem = stemSafeFrom(item);
            const fallbackSrc = `/thumbs/${section}/${stem}-w480.jpg`;
            const width  = item.width  || '';
            const height = item.height || '';
            const alt = (item.title || '').replace(/"/g, '&quot;');
            return `
<picture>
  <source type="image/avif" srcset="${srcsetFor(item,'avif')}" sizes="${searchSizes}">
  <source type="image/webp" srcset="${srcsetFor(item,'webp')}" sizes="${searchSizes}">
  <img
    src="${fallbackSrc}"
    srcset="${srcsetFor(item,'jpg')}"
    sizes="${searchSizes}"
    alt="${alt}"
    ${width ? `width="${width}"` : ''}
    ${height ? `height="${height}"` : ''}
    loading="${priority ? 'eager' : 'lazy'}"
    fetchpriority="${priority ? 'high' : 'auto'}"
    decoding="async"
  >
</picture>`.trim();
        }

        // ---------- render pages (simple list with snippet) ----------
        pagesUl.innerHTML = '';
        if (pageResults.length) {
            pagesSec.hidden = false;
            for (const p of pageResults) {
                const li = document.createElement('li');
                li.className = 'page-item';
                const titleHtml   = highlightTitle(p.title || '');
                const snippetHtml = makeSnippet(p, p._matches);
                li.innerHTML = `
            <a class="page-link" href="${p.url}">${titleHtml}</a>
            ${snippetHtml ? `<p class="snippet">${snippetHtml}</p>` : ''}
          `;
                pagesUl.appendChild(li);
            }
        } else {
            pagesSec.hidden = true;
        }

        // ---------- render images as GalleryCard-equivalent markup ----------
        function searchItemToGalleryMarkup(item, index) {
            // choose best landing page (sorted preference) for the anchor
            const sortedAppears = sortAppearsOn(item.appearsOn || []);
            const sectionForAnchor = (sortedAppears[0] || `/${item.section || ''}`).replace(/^\//, '');
            const stem   = item.stem || item.slug || '';
            const ar     = item.ar ?? 0.75;
            const rows   = Math.max(1, item.rows ?? 1);
            const href   = `/${sectionForAnchor}#${stem}`; // link-to-anchor behavior

            const titleHtml   = highlightTitle(item.title || '');
            const snippetHtml = makeSnippet(item, item._matches);
            const chipsHtml = [
                item.artist ? `<span class="chip">${item.artist}</span>` : '',
            ].join('');
            const alsoHtml = sortedAppears.length
                ? `<p class="also-on">
               Appears on:
               ${sortedAppears.map((p, i) =>
                    `<span class="also-link"><a href="${p}">${p}</a>${i < sortedAppears.length - 1 ? ', ' : ''}</span>`
                ).join('')}
             </p>`
                : '';

            return `
<div class="card-wrap">
  <a
    id="${stem}"
    class="card"
    style="grid-row-end: span ${rows}; --ar:${ar};"
    data-index="${index}"
    data-ar="${ar}"
    href="${href}"
    rel="noopener"
    data-title="${(item.title || '').replace(/"/g,'&quot;')}"
    data-year="${item.year || ''}"
    data-artist="${(item.artist || '').replace(/"/g,'&quot;')}"
    data-desc="${(item.description || '').replace(/"/g,'&quot;')}"
    data-sale="${item.sale || 'PRIVATE'}"
    data-section="${sectionForAnchor}"
    data-stem="${stem}"
  >
    ${pictureHTML(item, index === 0)}  <!-- responsive avif/webp/jpg -->
    <div class="overlay" aria-hidden="true">
      <div>
        <div class="title">${item.title || ''}</div>
        ${item.year ? `<div class="sub">${item.year}</div>` : ''}
      </div>
    </div>
  </a>

  <div class="card-body">
    <a class="title" href="${href}">${titleHtml}</a>
    <div class="chips">${chipsHtml}</div>
    ${snippetHtml ? `<p class="snippet">${snippetHtml}</p>` : ''}
    ${alsoHtml}
  </div>
</div>
`.trim();
        }

        // pagination/render cycle for images
        function setPage(newPage) {
            page = newPage;
            const totalImg   = imageResults.length;
            const totalPages = Math.max(1, Math.ceil(totalImg / per));
            const start      = (page - 1) * per;
            const end        = Math.min(start + per, totalImg);

            gridEl.innerHTML = '';
            if (totalImg) {
                imgsSec.hidden = false;
                const slice = imageResults.slice(start, end);
                const html = slice.map(searchItemToGalleryMarkup).join('\n');
                gridEl.innerHTML = html;

                if (totalPages > 1) {
                    pager.hidden = false;
                    prevBtn.textContent = '« Prev';
                    nextBtn.textContent = 'Next »';
                    prevBtn.classList.toggle('disabled', page <= 1);
                    nextBtn.classList.toggle('disabled', page >= totalPages);
                    prevBtn.href = page <= 1 ? '#' : (`/search?${new URLSearchParams({ q, page: String(page-1), per: String(per) }).toString()}`);
                    nextBtn.href = page >= totalPages ? '#' : (`/search?${new URLSearchParams({ q, page: String(page+1), per: String(per) }).toString()}`);
                    pageInfo.textContent = `Page ${page} of ${totalPages}`;
                } else {
                    pager.hidden = true;
                }
            } else {
                imgsSec.hidden = false;
                gridEl.innerHTML = '<p>No images matched your query.</p>';
                pager.hidden = true;
            }
        }

        setPage(page);
    
})();
