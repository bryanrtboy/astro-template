import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
    loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        id: z.number().optional(),
        type: z.enum(['page']).default('page'),
        parent: z.number().default(0),
        wpSlug: z.string().optional(),
        title: z.string(),
        layout: z.string().optional(),
        modified: z.string().optional(),
        date: z.string().optional(),
        menuOrder: z.number().default(0),
        featuredMedia: z.number().default(0),
        excerpt: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        gallery: z.boolean().optional(),
        galleryInclude: z.array(z.string()).optional(),
        galleryExclude: z.array(z.string()).optional(),
        showInParent: z.boolean().default(true),
    }),
});

export const collections = {
    pages,
};
