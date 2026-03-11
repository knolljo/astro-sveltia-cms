import { glob } from "astro/loaders";
import { z } from "astro/zod";
import type { CmsConfig, EntryCollection, Field } from "@sveltia/cms";
import { readCmsConfig, resolveCollection } from "./config.js";
import { sveltiaSchema } from "./schema.js";

export { readCmsConfig, resolveCollection } from "./config.js";
export {
  frontmatterFormats,
  isOptionalField,
  getSelectValues,
  selectValuesToZod,
  fieldToZod,
  sveltiaSchema,
} from "./schema.js";

// `load` uses `any` because `LoaderContext` contains deep Vite/Rollup types that differ
// between astro versions, causing "excessive stack depth" errors.
export interface SveltiaLoader {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: (context: any) => Promise<void>;
  schema?: z.ZodType | (() => z.ZodType);
}

export type SveltiaEntryCollection = EntryCollection;
export type SveltiaField = Field;
export type SveltiaConfig = CmsConfig;

/**
 * File formats that store the document body separately from frontmatter.
 * The default format (undefined) is yaml-frontmatter, so undefined is treated
 * as a frontmatter format.
 */
const FRONTMATTER_FORMATS = new Set(["yaml-frontmatter", "toml-frontmatter", "json-frontmatter"]);

function isFrontmatterFormat(format: string | undefined): boolean {
  return !format || FRONTMATTER_FORMATS.has(format);
}

// Module-level cache: keyed by collection name so multiple sveltiaLoader("posts")
// calls share the same resolved EntryCollection without repeated disk reads.
const collectionCache = new Map<string, EntryCollection>();

function loaderFromCollection(collection: EntryCollection): SveltiaLoader {
  const extension = collection.extension ?? "md";
  const isFrontmatter = isFrontmatterFormat(collection.format);
  const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });

  return {
    name: "sveltia-cms",
    load: (context) => inner.load(context),
    schema: sveltiaSchema(collection.fields, { excludeBody: isFrontmatter }),
  };
}

function getCachedCollection(name: string): EntryCollection {
  const cached = collectionCache.get(name);
  if (cached) return cached;
  const config = readCmsConfig();
  const collection = resolveCollection(config, name);
  collectionCache.set(name, collection);
  return collection;
}

export function sveltiaLoader(collectionOrName: string | EntryCollection): SveltiaLoader {
  if (typeof collectionOrName !== "string") {
    return loaderFromCollection(collectionOrName);
  }

  const name = collectionOrName;

  return {
    name: "sveltia-cms",

    schema: () => {
      const collection = getCachedCollection(name);
      return sveltiaSchema(collection.fields, {
        excludeBody: isFrontmatterFormat(collection.format),
      });
    },

    load: async (context) => {
      const collection = getCachedCollection(name);
      const extension = collection.extension ?? "md";
      const inner = glob({
        pattern: `**/*.${extension}`,
        base: collection.folder,
      });
      return inner.load(context);
    },
  };
}
