// @ts-check
import { defineConfig } from "astro/config";
import sveltia from "@joknoll/astro-sveltia-cms";

// https://astro.build/config
export default defineConfig({
  integrations: [
    sveltia({
      route: "/cms",
      title: "My Custom CMS",
      config: {
        backend: {
          name: "test-repo",
        },
        media_folder: "public/media",

        // Collections are defined here — the single source of truth.
        // Reference them by name in content.config.ts with sveltiaLoader("posts").
        collections: [
          {
            name: "posts",
            label: "Posts",
            folder: "src/content/posts",
            create: true,
            fields: [
              { label: "Title", name: "title", widget: "string" },
              { label: "Date", name: "date", widget: "datetime" },
              {
                label: "Draft",
                name: "draft",
                widget: "boolean",
                required: false,
              },
              { label: "Body", name: "body", widget: "markdown" },
            ],
          },
          {
            name: "metadata",
            label: "Posts",
            folder: "src/content/posts",
            create: true,
            fields: [
              { label: "Title", name: "title", widget: "string" },
              { label: "Date", name: "date", widget: "datetime" },
              {
                label: "Draft",
                name: "draft",
                widget: "boolean",
                required: false,
              },
              { label: "Body", name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
