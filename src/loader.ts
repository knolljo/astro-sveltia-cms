import { glob } from "astro/loaders";
import type { CmsConfig, EntryCollection, Field } from "@sveltia/cms";
import { readCmsConfig, resolveCollection } from "./config.js";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;
}

export type SveltiaEntryCollection = EntryCollection;
export type SveltiaField = Field;
export type SveltiaConfig = CmsConfig;

function loaderFromCollection(collection: EntryCollection): SveltiaLoader {
  const extension = collection.extension ?? "md";
  const isFrontmatter = frontmatterFormats.has(collection.format);
  const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });

  return {
    name: "sveltia-cms",
    load: (context) => inner.load(context),
    schema: sveltiaSchema(collection.fields, { excludeBody: isFrontmatter }),
  };
}

function makeLazyCollection(name: string): () => EntryCollection {
  let cached: EntryCollection | undefined;
  return () => {
    if (!cached) {
      const config = readCmsConfig();
      cached = resolveCollection(config, name);
    }
    return cached;
  };
}

export function sveltiaLoader(collectionOrName: string | EntryCollection): SveltiaLoader {
  if (typeof collectionOrName !== "string") {
    return loaderFromCollection(collectionOrName);
  }

  const getCollection = makeLazyCollection(collectionOrName);

  return {
    name: "sveltia-cms",

    schema: () => {
      const collection = getCollection();
      const isFrontmatter = frontmatterFormats.has(collection.format);
      return sveltiaSchema(collection.fields, { excludeBody: isFrontmatter });
    },

    load: async (context) => {
      const collection = getCollection();
      const extension = collection.extension ?? "md";
      const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });
      return inner.load(context);
    },
  };
}
