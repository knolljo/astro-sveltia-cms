import { defineCollection } from "astro:content";

import { sveltiaLoader } from "@joknoll/astro-sveltia-cms/loader";

// Collections are defined in astro.config.mjs.
// Just reference them by name here — schema is auto-generated.
const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { posts };
