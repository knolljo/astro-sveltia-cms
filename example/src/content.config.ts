import { defineCollection } from "astro:content";

import { sveltiaLoader } from "astro-sveltiacms/loader";

// Collections are defined in astro.config.mjs.
// Just reference them by name here, schema is auto-generated.
const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { posts };
