import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Blog posts are Markdown files in src/content/blog. Files starting with "_" are ignored (see _example-post.md).
// `alternate` is the path of the same post in the other language, for hreflang and the EN/PL switch.
// Post images are plain files in public/images/blog/<post>/, because the Markdown uses <picture> with root paths.
const blog = defineCollection({
  loader: glob({ pattern: '[^_]*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    excerpt: z.string(),
    slug: z.string().optional(),
    lang: z.enum(['en', 'pl']).default('en'),
    translationKey: z.string().optional(),
    alternate: z.string().optional(),
    pubDate: z.coerce.date(),
    author: z.string().default('Daniel Nowak'),
    tags: z.array(z.string()).default([]),
    readingTime: z.number(),
    heroImage: z.string(),
    heroAlt: z.string(),
    ogImage: z.string().optional(),
    ogAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
