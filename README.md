# astro-sveltia-cms

Sveltia CMS integration for Astro.

## Installation

```bash
npm install astro-sveltia-cms @sveltia/cms

bun add astro-sveltia-cms @sveltia/cms

deno add astro-sveltia-cms @sveltia/cms
```

## Usage

In your `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import sveltia from "astro-sveltia-cms";

export default defineConfig({
  integrations: [
    sveltia({
      route: "/cms", // Optional, defaults to "/admin"
      title: "My CMS", // Optional, defaults to "Sveltia CMS"
      config: {
        backend: {
          name: "github",
          repo: "my/repo",
          branch: "main",
        },
        media_folder: "public/images",
        collections: [
          // ... your collections
        ],
      },
    }),
  ],
});
```

This will serve the Sveltia CMS admin interface at `/cms` (or `/admin` by default).
The configuration object is passed directly to `CMS.init()`.

## Backend Configuration

The `config.backend` property determines where your content is stored. Sveltia CMS supports various Git-based backends and a local development backend.

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

For more details on backend configuration, including authentication and other providers, see the [Sveltia CMS Backend Documentation](https://sveltiacms.app/en/docs/backends).
