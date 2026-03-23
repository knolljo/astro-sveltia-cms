import { glob } from "astro/loaders";
import type { Loader, LoaderContext } from "astro/loaders";
import type { CmsConfig, EntryCollection, Field } from "@sveltia/cms";
import { readCmsConfig, resolveCollection } from "./config.js";
import { frontmatterFormats } from "./schema.js";
import { transformFieldValues } from "./transforms.js";
import { buildCollectionSchema } from "./type-gen.js";

export { readCmsConfig, resolveCollection } from "./config.js";
export {
  frontmatterFormats,
  isOptionalField,
  getSelectValues,
  selectValuesToZod,
  fieldToZod,
  sveltiaSchema,
} from "./schema.js";

export type SveltiaLoader = Loader;
export type SveltiaEntryCollection = EntryCollection;
export type SveltiaField = Field;
export type SveltiaConfig = CmsConfig;

// Module-level cache: keyed by collection name so multiple sveltiaLoader("posts")
// calls share the same resolved EntryCollection without repeated disk reads.
const collectionCache = new Map<string, EntryCollection>();

function getCachedCollection(name: string): EntryCollection {
  const cached = collectionCache.get(name);
  if (cached) return cached;
  const config = readCmsConfig();
  const collection = resolveCollection(config, name);
  collectionCache.set(name, collection);
  return collection;
}

function wrapContextWithTransforms(context: LoaderContext, collection: EntryCollection): LoaderContext {
  const excludeBody = frontmatterFormats.has(collection.format);
  return {
    ...context,
    parseData: <TData extends Record<string, unknown>>(opts: {
      id: string;
      data: TData;
      filePath?: string;
    }) => {
      const transformed = transformFieldValues(
        opts.data as Record<string, unknown>,
        collection.fields,
        excludeBody,
      );
      return context.parseData({ ...opts, data: transformed as TData });
    },
  };
}

export function sveltiaLoader(collectionOrName: string | EntryCollection): Loader {
  const getCollection =
    typeof collectionOrName === "string"
      ? () => getCachedCollection(collectionOrName)
      : () => collectionOrName;

  return {
    name: "sveltia-cms",
    createSchema: async () => buildCollectionSchema(getCollection()),
    load: async (context) => {
      const collection = getCollection();
      const extension = collection.extension ?? "md";
      return glob({ pattern: `**/*.${extension}`, base: collection.folder }).load(
        wrapContextWithTransforms(context, collection),
      );
    },
  } satisfies Loader;
}
