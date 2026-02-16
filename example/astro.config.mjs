// @ts-check
import { defineConfig } from "astro/config";
import sveltia from "astro-sveltia-cms";

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

        collections: [
          {
            name: "posts",
            label: "Posts",
            folder: "src/content/posts",
            create: true,
            fields: [
              { label: "Title", name: "title", widget: "string" },
              { label: "Body", name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
