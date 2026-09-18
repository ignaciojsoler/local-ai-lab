// Content collections for this site are defined here.
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const experiments = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/experiments" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** transformers.js pipeline task, e.g. "text-classification". */
    task: z.string(),
    /** Hugging Face model id, e.g. "Xenova/vit-base-patch16-224". */
    model: z.string(),
    /** Human-readable download size shown before fetching, e.g. "~67 MB". */
    sizeLabel: z.string(),
    /** Grouping label for the left rail, e.g. "Vision" or "Language". */
    category: z.string(),
    /** Display order on the index page. */
    order: z.number(),
  }),
});

export const collections = { experiments };
