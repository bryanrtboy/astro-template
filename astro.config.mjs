// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
    site: 'https://www.bryanleister.com',

    // Inline tiny route CSS into the HTML to avoid a render-blocking request
    // (your ~2.2 KiB /_astro/_section_*.css will be inlined).
    build: {
        inlineStylesheets: 'always', // 'auto' inlines small CSS bundles
    },

    // Make sure the “small asset” threshold covers that CSS size explicitly.
    // (Also applies to tiny images/scripts; default is 4096 bytes anyway.)
    vite: {
        build: {
            assetsInlineLimit: 4096,
        },
    },

    // Speed up navigations by prefetching internal links.
    // Safe defaults: only prefetch links you mark with data-astro-prefetch.
    // If you want it on *every* link automatically, set prefetchAll: true.
    prefetch: {
        defaultStrategy: 'hover',
        prefetchAll: false,
    },

    integrations: [
        sitemap(),
        mdx(),
    ],
    optimizeDeps: {
        include: ['fuse.js'], // ensures dev prebundling; harmless in build
    },
});
