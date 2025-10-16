// src/content/config.ts
import { defineCollection, z } from 'astro:content';

// Shared schema for anything you might want searchable
const searchableFields = {
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
};

// Individual collections
const projects = defineCollection({
    type: 'content',
    schema: z.object({
        ...searchableFields,
        subtitle: z.string().optional(),
    }),
});

const sections = defineCollection({
    type: 'content',
    schema: z.object({
        ...searchableFields,
    }),
});

export const collections = {
    projects,
    sections
};
