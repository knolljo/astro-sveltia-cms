import { readFileSync } from "node:fs";
import type { CmsConfig, EntryCollection, FileCollection } from "@sveltia/cms";

const CONFIG_PATH = ".astro/integrations/astro-sveltia-cms/config.json";

export function readCmsConfig(): CmsConfig {
  const configPath = `${process.cwd()}/${CONFIG_PATH}`;
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as CmsConfig;
  } catch {
    throw new Error(
      `[sveltiaLoader] Could not read CMS config from ${configPath}. ` +
        `Make sure the astro-sveltia-cms integration is added to your astro.config.mjs.`,
    );
  }
}

export function resolveCollection(config: CmsConfig, name: string): EntryCollection {
  const collections = config.collections ?? [];
  const match = collections.find((c) => "name" in c && c.name === name);

  if (!match) {
    const available = collections
      .filter((c): c is EntryCollection | FileCollection => "name" in c)
      .map((c) => c.name);
    const list = available.length > 0 ? available.join(", ") : "(none)";
    throw new Error(
      `[sveltiaLoader] Collection "${name}" not found in CMS config. ` +
        `Available collections: ${list}`,
    );
  }

  if (!("folder" in match) || !("fields" in match)) {
    throw new Error(
      `[sveltiaLoader] Collection "${name}" is not a folder-based entry collection. ` +
        `Only entry collections (with "folder" and "fields") are supported by sveltiaLoader.`,
    );
  }

  return match as EntryCollection;
}
