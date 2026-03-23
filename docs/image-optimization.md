# Image Optimization in Content Collections

Astro's image optimization for content collections normally requires the `image()` helper from `SchemaContext`, which is only available when defining a collection schema inline. This loader uses two complementary techniques to achieve both **image optimization** and **TypeScript autocomplete** — without requiring any `schema:` override in `defineCollection`.

## The Problem

Two Astro mechanisms are in tension:

- **Image optimization** needs `image()` from `SchemaContext`. But `Loader.createSchema` receives no arguments, so `image()` is unavailable there.
- **TypeScript autocomplete** requires `createSchema` to return a `types` string. But if you provide `schema:` in `defineCollection`, Astro ignores `createSchema` entirely — both the Zod schema and the generated types are discarded.

The goal: make `post.data.cover` behave as `ImageMetadata` at runtime and in TypeScript, using only `createSchema`.

## Solution Part 1: Autocomplete via `TypeOverrideMap`

`createSchema` generates TypeScript type declarations using `zod-to-ts`. Without intervention, an image field is `z.string()`, which renders as `string` in the generated types — giving you a `string` where you expect `ImageMetadata`.

The fix uses `TypeOverrideMap`, which maps specific Zod schema **instances** (by reference identity) to custom TypeScript AST nodes. An `ImageSchemaCollector` accumulates the exact `z.string()` instances created for image fields as the schema is built:

```typescript
const imageSchemas: ImageSchemaCollector = { schemas: [] };
const schema = sveltiaSchema(collection.fields, { imageSchemas });
// imageSchemas.schemas holds the exact z.string() instances for image fields

const overrides: TypeOverrideMap = new Map(
  imageSchemas.schemas.map((s) => [s, (ts) => ts.factory.createTypeReferenceNode("ImageMetadata")]),
);
```

When `zodToTs` traverses the schema to emit TypeScript, it checks each Zod node against `overrides`. The image field's `z.string()` matches by reference → it renders as `ImageMetadata` instead of `string`. An import is prepended to the types string:

```typescript
import type { ImageMetadata } from "astro";
export type Entry = { title: string; cover?: ImageMetadata; ... }
```

This is written into `.astro/types.d.ts` and powers autocomplete on `post.data.cover`.

## Solution Part 2: Image optimization via `__ASTRO_IMAGE_` prefix injection

Astro detects image fields at build/load time by scanning stored entry data for strings that start with `__ASTRO_IMAGE_`. Normally this prefix is added by the `image()` Zod transform, which runs inside `parseData`. Since `image()` isn't available in `createSchema`, the prefix is injected by wrapping `parseData` in the loader context:

```typescript
// wrapContextForImages replaces context.parseData before delegating to the inner glob loader
context.parseData = (opts) => {
  const transformed = transformFieldValues(opts.data, collection.fields);
  return originalParseData({ ...opts, data: transformed });
};
```

`transformFieldValues` walks the raw frontmatter data guided by the CMS field definitions. When it finds an image field value like `../../assets/image.webp`, it transforms it to `__ASTRO_IMAGE_../../assets/image.webp` before the data reaches Astro's store.

Astro's pipeline then handles the rest automatically:

1. **`mutable-data-store.js`** traverses stored entry data, finds `__ASTRO_IMAGE_` strings, strips the prefix, and registers the path as a Vite asset import — tagged with the markdown file's path as the `importer`.
2. **`vite-plugin-content-assets.js`** resolves the image path relative to the markdown file using the `importer` parameter, producing a proper module ID for the image file.
3. **`runtime.js`** (called by `getCollection`) runs `updateImageReferencesInData`, which replaces each `__ASTRO_IMAGE_` string with the real `ImageMetadata` object from Vite's asset map.

The result: `post.data.cover` is a real `ImageMetadata` at runtime.

## Image path format

Image paths in frontmatter must be **relative to the markdown file** (or a URL for remote images). Absolute project-root paths like `src/assets/image.webp` will not resolve correctly — they get interpreted as relative to the markdown file's directory.

```yaml
# src/content/posts/hello-world.md
cover: ../../assets/image.webp   # correct: relative to this file
cover: src/assets/image.webp     # wrong: resolves to src/content/posts/src/assets/...
cover: /src/assets/image.webp    # wrong: treated as URL, not a local file
```

Vite alias paths (e.g. `@/assets/image.webp`) are passed through unchanged and resolved by Vite's alias plugin, provided the alias is configured in `vite.config` or `tsconfig.json` paths and Vite picks it up.

## Usage

No configuration is needed. Define the collection using only the loader:

```typescript
// src/content.config.ts
import { defineCollection } from "astro:content";
import { sveltiaLoader } from "astro-loader-sveltia-cms/loader";

const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { posts };
```

Add an `image` widget to the collection in your CMS config:

```javascript
{
  name: "cover",
  label: "Cover Image",
  widget: "image",
  required: false,
}
```

Then use the image in your pages:

```astro
---
import { Image } from "astro:assets";
import { getCollection } from "astro:content";

const posts = await getCollection("posts");
---

{posts.map(post => (
  post.data.cover && <Image src={post.data.cover} alt={post.data.title} />
))}
```

`post.data.cover` will be typed as `ImageMetadata | undefined` and will be a real `ImageMetadata` object at runtime, enabling full Astro image optimization (resizing, format conversion, lazy loading).
