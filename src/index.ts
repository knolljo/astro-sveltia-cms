import type { AstroIntegration } from "astro";
import type { CmsConfig, EntryCollection } from "@sveltia/cms";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type { CmsConfig };

export type SveltiaConfig = CmsConfig;

export type SveltiaOptions = {
  route?: string;
  title?: string;
  config: CmsConfig;
};

const VIRTUAL_MODULE_ID = "virtual:astro-sveltia-cms/config";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

function isEntryCollection(c: unknown): c is EntryCollection {
  return (
    typeof c === "object" &&
    c !== null &&
    "name" in c &&
    typeof (c as EntryCollection).name === "string" &&
    "folder" in c &&
    "fields" in c
  );
}

function getEntryCollectionNames(config: CmsConfig): string[] {
  return (config.collections ?? []).filter(isEntryCollection).map((c) => c.name);
}

function buildVirtualModuleSource(config: CmsConfig, title: string): string {
  return `
    export const config = ${JSON.stringify(config)};
    export const title = ${JSON.stringify(title)};
  `;
}

function buildTypeDeclaration(collectionNames: string[]): string {
  const unionType = collectionNames.map((n) => JSON.stringify(n)).join(" | ");
  return `declare module "@joknoll/astro-sveltia-cms/loader" {
  import type { EntryCollection } from "@sveltia/cms";

  type SveltiaCollectionName = ${unionType};

  export function sveltiaLoader(name: SveltiaCollectionName): import("@joknoll/astro-sveltia-cms/loader").SveltiaLoader;
  export function sveltiaLoader(collection: EntryCollection): import("@joknoll/astro-sveltia-cms/loader").SveltiaLoader;
}
`;
}

export default function sveltiaCms(options: SveltiaOptions): AstroIntegration {
  const route = options.route ?? "/admin";
  const title = options.title ?? "Sveltia CMS";
  const config: CmsConfig = { ...options.config, load_config_file: false };

  return {
    name: "astro-sveltia-cms",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig, createCodegenDir, logger }) => {
        injectRoute({
          pattern: route,
          entrypoint: new URL("./admin.astro", import.meta.url),
        });

        // Write config to .astro/integrations/astro-sveltia-cms/config.json so
        // the content loader can read it without a live Vite server.
        const codegenDir = createCodegenDir();
        const configPath = fileURLToPath(new URL("config.json", codegenDir));
        writeFileSync(configPath, JSON.stringify(config));

        // Register the virtual module used by admin.astro at runtime.
        updateConfig({
          vite: {
            plugins: [
              {
                name: "vite-plugin-astro-sveltia-cms-config",
                resolveId(id) {
                  if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
                },
                load(id) {
                  if (id === RESOLVED_VIRTUAL_MODULE_ID) {
                    return buildVirtualModuleSource(config, title);
                  }
                },
              },
            ],
          },
        });

        logger.info(`Sveltia CMS injected at ${route}`);
      },

      "astro:config:done": ({ injectTypes }) => {
        const collectionNames = getEntryCollectionNames(config);
        if (collectionNames.length === 0) return;

        injectTypes({
          filename: "types.d.ts",
          content: buildTypeDeclaration(collectionNames),
        });
      },
    },
  };
}
