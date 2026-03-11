# astro-loader-sveltia-cms

Sveltia CMS integration for Astro 6.
This serves the [Sveltia CMS](https://sveltiacms.app) admin UI and provides a
**content loader** for Astro's content collections, including automatic Zod schema generation.

## Installation

```bash
npm install astro-loader-sveltia-cms
# or
bun add astro-loader-sveltia-cms
```

## Quick Start

Register the integration in **`astro.config.mjs`**:

```js
import { defineConfig } from "astro/config";
import sveltia from "astro-loader-sveltia-cms";

export default defineConfig({
  integrations: [
    sveltia({
      config: {
        backend: {
          name: "github",
          repo: "my-org/my-site",
          branch: "main",
        },
        media_folder: "public/images",
        collections: [
          {
            name: "posts",
            folder: "src/content/posts",
            fields: [
              { name: "title", widget: "string" },
              { name: "date", widget: "datetime" },
              { name: "draft", widget: "boolean", required: false },
              { name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
```

Use the content loader in **`src/content.config.ts`**:

```ts
import { defineCollection } from "astro:content";
import { sveltiaLoader } from "astro-loader-sveltia-cms/loader";

const posts = defineCollection({
  loader: sveltiaLoader("posts"),
});

export const collections = { posts };
```

Query the collection on your pages:

```astro
---
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<h1>{post.data.title}</h1>
<Content />
```

You can also clone this repository and use it as a starting point for your own project, look into the `example` directory.

---

## Integration Options

```ts
sveltia({
  route?: string,   // URL path for the CMS admin UI. Defaults to "/admin".
  title?: string,   // Browser tab title for the admin UI. Defaults to "Sveltia CMS".
  config: CmsConfig // Full Sveltia CMS configuration object (required).
})
```

---

## Backend Configuration

The `config.backend` property determines where your content is stored. Sveltia CMS supports various Git-based backends and a local development backend.

For all backend options including local development and authentication, see the
[Sveltia CMS Backend Documentation](https://sveltiacms.app/en/docs/backends).

### GitHub

```js
backend: {
  name: "github",
  repo: "username/repo",
  branch: "main",
}
```

### Gitea / Codeberg

```js
backend: {
  name: "gitea",
  repo: "username/repo",
  base_url: "https://codeberg.org",
  api_root: "https://codeberg.org/api/v1",
}
```
