import type { AstroIntegration } from "astro";
import type { CmsConfig } from "@sveltia/cms";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type { CmsConfig };

/**
 * The full Sveltia CMS configuration object.
 * Alias for `CmsConfig` from `@sveltia/cms`.
 */
export type SveltiaConfig = CmsConfig;

export type SveltiaOptions = {
  /**
   * The route where the CMS will be served.
   * @default "/admin"
   */
  route?: string;
  /**
   * The page title for the CMS admin interface.
   * @default "Sveltia CMS"
   */
  title?: string;
  /**
   * The Sveltia CMS configuration object.
   */
  config: CmsConfig;
};

export default function sveltiaCms(options: SveltiaOptions): AstroIntegration {
  const route = options.route || "/admin";
  const title = options.title || "Sveltia CMS";
  const virtualModuleId = "virtual:astro-sveltia-cms/config";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  const config = {
    ...options.config,
    load_config_file: false,
  };

  return {
    name: "astro-sveltia-cms",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig, createCodegenDir, logger }) => {
        // Inject the admin page route
        injectRoute({
          pattern: route,
          entrypoint: new URL("./admin.astro", import.meta.url),
        });

        // Write the CMS config to a JSON file in .astro/astro-sveltia-cms/
        // so the content loader can read it without a live Vite server.
        const codegenDir = createCodegenDir();
        const configPath = fileURLToPath(new URL("config.json", codegenDir));
        writeFileSync(configPath, JSON.stringify(config));

        // Register the virtual module plugin (used by admin.astro at runtime)
        updateConfig({
          vite: {
            plugins: [
              {
                name: "vite-plugin-astro-sveltia-cms-config",
                resolveId(id) {
                  if (id === virtualModuleId) {
                    return resolvedVirtualModuleId;
                  }
                },
                load(id) {
                  if (id === resolvedVirtualModuleId) {
                    return `
                      export const config = ${JSON.stringify(config)};
                      export const title = ${JSON.stringify(title)};
                    `;
                  }
                },
              },
            ],
          },
        });

        logger.info(`Sveltia CMS injected at ${route}`);
      },

      "astro:config:done": ({ injectTypes }) => {
        // Extract entry collection names from the CMS config
        const collectionNames = (config.collections ?? [])
          .filter(
            (c) =>
              "name" in c &&
              typeof (c as { name?: string }).name === "string" &&
              "folder" in c &&
              "fields" in c,
          )
          .map((c) => (c as { name: string }).name);

        if (collectionNames.length === 0) return;

        // Build a string literal union type: "posts" | "pages" | ...
        const unionType = collectionNames.map((n) => JSON.stringify(n)).join(" | ");

        injectTypes({
          filename: "types.d.ts",
          content: `declare module "@joknoll/astro-sveltia-cms/loader" {
  import type { EntryCollection } from "@sveltia/cms";

  type SveltiaCollectionName = ${unionType};

  export function sveltiaLoader(name: SveltiaCollectionName): import("@joknoll/astro-sveltia-cms/loader").SveltiaLoader;
  export function sveltiaLoader(collection: EntryCollection): import("@joknoll/astro-sveltia-cms/loader").SveltiaLoader;
}
`,
        });
      },
    },
  };
}
