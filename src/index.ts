import type { AstroIntegration } from "astro";
import type { CmsConfig } from "@sveltia/cms";

export type { CmsConfig };

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
      "astro:config:setup": ({ injectRoute, updateConfig, logger }) => {
        // Inject the admin page route
        injectRoute({
          pattern: route,
          entrypoint: new URL("./admin.astro", import.meta.url),
        });

        // Register the virtual module plugin
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
    },
  };
}
