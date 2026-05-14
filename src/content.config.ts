import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
    type: 'content',
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
        gallery: z.boolean().default(false),
        showInParent: z.boolean().default(true),
    }),
});

export const collections = {
    pages,
};
