import { readFileSync } from "node:fs";
import type { CmsConfig, EntryCollection, FileCollection } from "@sveltia/cms";

const CONFIG_PATH = ".astro/integrations/astro-loader-sveltia-cms/config.json";

export function readCmsConfig(): CmsConfig {
  const configPath = `${process.cwd()}/${CONFIG_PATH}`;
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(
        `[sveltiaLoader] CMS config at ${configPath} is not a valid JSON object ` +
          `(got ${parsed === null ? "null" : typeof parsed}).`,
      );
    }
    return parsed as CmsConfig;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("[sveltiaLoader]")) throw err;
    throw new Error(
      `[sveltiaLoader] Could not read CMS config from ${configPath}. ` +
        `Make sure the astro-loader-sveltia-cms integration is added to your astro.config.mjs.`,
    );
  }
}

export function resolveCollection(config: CmsConfig, name: string): EntryCollection {
  const collections = config.collections ?? [];
  // Phase 1: find any named collection (EntryCollection or FileCollection).
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

  // Phase 2: narrow to an entry collection (folder-based, with fields).
  if (!("folder" in match) || !("fields" in match)) {
    throw new Error(
      `[sveltiaLoader] Collection "${name}" is not a folder-based entry collection. ` +
        `Only entry collections (with "folder" and "fields") are supported by sveltiaLoader.`,
    );
  }

  return match as EntryCollection;
}
