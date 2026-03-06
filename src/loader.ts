import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CmsConfig,
  EntryCollection,
  Field,
  FileCollection,
  SelectFieldValue,
} from "@sveltia/cms";

/**
 * The file formats that use frontmatter (body is separate from data).
 */
const frontmatterFormats = new Set([
  "yaml-frontmatter",
  "toml-frontmatter",
  "json-frontmatter",
  undefined, // default format is yaml-frontmatter
]);

/**
 * Check if a field should be optional in the Zod schema.
 * Sveltia CMS defaults `required` to `true` for visible fields.
 */
function isOptionalField(field: Field): boolean {
  if (!("required" in field)) return false;
  return field.required === false;
}

/**
 * Convert select field options to an array of values.
 */
function getSelectValues(
  options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[],
): SelectFieldValue[] {
  if (options.length === 0) return [];
  if (typeof options[0] === "object" && options[0] !== null && "value" in options[0]) {
    return (options as { label: string; value: SelectFieldValue }[]).map((o) => o.value);
  }
  return options as SelectFieldValue[];
}

/**
 * Create a Zod schema for select field values.
 * Handles string-only enums, and mixed types (string | number | null).
 */
function selectValuesToZod(values: SelectFieldValue[]): z.ZodTypeAny {
  const allStrings = values.every((v) => typeof v === "string");
  if (allStrings && values.length > 0) {
    return z.enum(values as [string, ...string[]]);
  }
  // Mixed types: use union of literals
  if (values.length === 0) return z.any();
  const literals = values.map((v) => {
    if (v === null) return z.null();
    if (typeof v === "number") return z.literal(v);
    return z.literal(v as string);
  });
  if (literals.length === 1) return literals[0];
  return z.union(literals as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

/**
 * Convert a single Sveltia CMS field definition to a Zod schema type.
 * This recursively handles nested fields (object, list).
 */
function fieldToZod(field: Field): z.ZodTypeAny {
  const widget = "widget" in field ? field.widget : "string";

  switch (widget) {
    // Simple string types
    case "string":
    case "text":
    case "color":
    case "map":
    case "uuid":
    case "compute":
      return z.string();

    // Markdown/richtext as standalone data fields (not body)
    case "markdown":
    case "richtext":
      return z.string();

    // Number field
    case "number": {
      const valueType =
        "value_type" in field ? (field as { value_type?: string }).value_type : "int";
      if (valueType === "int/string" || valueType === "float/string") {
        return z.union([z.number(), z.string()]);
      }
      return z.number();
    }

    // Boolean field
    case "boolean":
      return z.boolean();

    // DateTime field
    case "datetime":
      return z.coerce.date();

    // Image and file fields
    case "image":
    case "file": {
      const multiple = "multiple" in field && (field as { multiple?: boolean }).multiple;
      return multiple ? z.array(z.string()) : z.string();
    }

    // Select field
    case "select": {
      const selectField = field as {
        options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[];
        multiple?: boolean;
      };
      const values = getSelectValues(selectField.options);
      const valueSchema = selectValuesToZod(values);
      return selectField.multiple ? z.array(valueSchema) : valueSchema;
    }

    // Relation field
    case "relation": {
      const multiple = "multiple" in field && (field as { multiple?: boolean }).multiple;
      return multiple ? z.array(z.string()) : z.string();
    }

    // KeyValue field
    case "keyvalue":
      return z.record(z.string(), z.string());

    // Code field
    case "code": {
      const codeField = field as {
        output_code_only?: boolean;
        keys?: { code: string; lang: string };
      };
      if (codeField.output_code_only) {
        return z.string();
      }
      const keys = codeField.keys || { code: "code", lang: "lang" };
      return z.object({
        [keys.code]: z.string(),
        [keys.lang]: z.string(),
      });
    }

    // Hidden field - type depends on the default value
    case "hidden": {
      const hiddenField = field as { default?: unknown };
      if (hiddenField.default !== undefined) {
        switch (typeof hiddenField.default) {
          case "string":
            return z.string();
          case "number":
            return z.number();
          case "boolean":
            return z.boolean();
          default:
            return z.any();
        }
      }
      return z.any();
    }

    // Object field - recursive
    case "object": {
      const objectField = field as {
        fields?: Field[];
        types?: Array<{
          name: string;
          fields?: Field[];
        }>;
        typeKey?: string;
      };

      // Variable types (discriminated union)
      if ("types" in objectField && objectField.types) {
        const typeKey = objectField.typeKey || "type";
        const variants = objectField.types.map((variant) => {
          const shape: Record<string, z.ZodTypeAny> = {
            [typeKey]: z.literal(variant.name),
          };
          if (variant.fields) {
            for (const subField of variant.fields) {
              const subSchema = fieldToZod(subField);
              shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
            }
          }
          return z.object(shape);
        });
        if (variants.length === 0) return z.object({});
        if (variants.length === 1) return variants[0];
        return z.discriminatedUnion(
          typeKey,
          variants as [
            z.ZodObject<Record<string, z.ZodTypeAny>>,
            z.ZodObject<Record<string, z.ZodTypeAny>>,
            ...z.ZodObject<Record<string, z.ZodTypeAny>>[],
          ],
        );
      }

      // Regular object with subfields
      if ("fields" in objectField && objectField.fields) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const subField of objectField.fields) {
          const subSchema = fieldToZod(subField);
          shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
        }
        return z.object(shape);
      }

      return z.object({});
    }

    // List field - multiple variants
    case "list": {
      const listField = field as {
        field?: Field;
        fields?: Field[];
        types?: Array<{
          name: string;
          fields?: Field[];
        }>;
        typeKey?: string;
      };

      // List with variable types
      if ("types" in listField && listField.types) {
        const typeKey = listField.typeKey || "type";
        const variants = listField.types.map((variant) => {
          const shape: Record<string, z.ZodTypeAny> = {
            [typeKey]: z.literal(variant.name),
          };
          if (variant.fields) {
            for (const subField of variant.fields) {
              const subSchema = fieldToZod(subField);
              shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
            }
          }
          return z.object(shape);
        });
        if (variants.length === 0) return z.array(z.any());
        if (variants.length === 1) return z.array(variants[0]);
        return z.array(
          z.discriminatedUnion(
            typeKey,
            variants as [
              z.ZodObject<Record<string, z.ZodTypeAny>>,
              z.ZodObject<Record<string, z.ZodTypeAny>>,
              ...z.ZodObject<Record<string, z.ZodTypeAny>>[],
            ],
          ),
        );
      }

      // List with multiple subfields
      if ("fields" in listField && listField.fields) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const subField of listField.fields) {
          const subSchema = fieldToZod(subField);
          shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
        }
        return z.array(z.object(shape));
      }

      // List with single subfield
      if ("field" in listField && listField.field) {
        return z.array(fieldToZod(listField.field));
      }

      // Simple list (array of strings)
      return z.array(z.string());
    }

    // Unknown/custom widget
    default:
      return z.any();
  }
}

/**
 * Generate a Zod schema from an array of Sveltia CMS field definitions.
 *
 * This can be used standalone when you want to provide your own loader
 * but still auto-generate the schema from Sveltia CMS field definitions.
 *
 * @param fields - Array of Sveltia CMS field definitions
 * @param options - Options for schema generation
 * @param options.excludeBody - Whether to exclude body fields (default: true).
 *   Set to false if your collection doesn't use a frontmatter format.
 * @returns A Zod object schema
 *
 * @example
 * ```ts
 * import { defineCollection } from 'astro:content';
 * import { glob } from 'astro/loaders';
 * import { sveltiaSchema } from 'astro-sveltia-cms/loader';
 *
 * const posts = defineCollection({
 *   loader: glob({ pattern: '**\/*.md', base: './src/content/posts' }),
 *   schema: sveltiaSchema([
 *     { name: 'title', widget: 'string' },
 *     { name: 'date', widget: 'datetime' },
 *     { name: 'body', widget: 'markdown' },
 *   ]),
 * });
 * ```
 */
export function sveltiaSchema(
  fields: Field[],
  options?: {
    /** Whether to exclude body fields from the schema. Default: true. */
    excludeBody?: boolean;
  },
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const excludeBody = options?.excludeBody ?? true;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // Skip body fields by default
    if (
      excludeBody &&
      field.name === "body" &&
      "widget" in field &&
      (field.widget === "markdown" || field.widget === "richtext")
    ) {
      continue;
    }

    const schema = fieldToZod(field);
    shape[field.name] = isOptionalField(field) ? schema.optional() : schema;
  }

  return z.object(shape);
}

/**
 * Read the CMS config from the codegen JSON file written by the integration.
 * Located at `.astro/integrations/astro-sveltia-cms/config.json` relative to the project root.
 */
function readCmsConfig(): CmsConfig {
  // Astro runs with cwd set to the project root
  const configPath = join(
    process.cwd(),
    ".astro",
    "integrations",
    "astro-sveltia-cms",
    "config.json",
  );
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

/**
 * Resolve a collection name to an `EntryCollection` from the CMS config.
 * Throws descriptive errors if the collection is not found or is not a folder-based collection.
 */
function resolveCollection(config: CmsConfig, name: string): EntryCollection {
  const collections = config.collections ?? [];
  const match = collections.find((c) => "name" in c && c.name === name);

  if (!match) {
    const available = collections
      .filter((c): c is EntryCollection | FileCollection => "name" in c)
      .map((c) => c.name);
    throw new Error(
      `[sveltiaLoader] Collection "${name}" not found in CMS config. ` +
        `Available collections: ${available.length > 0 ? available.join(", ") : "(none)"}`,
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

/**
 * Structural type for an Astro content loader.
 * We define our own instead of re-exporting `Loader` from `astro/loaders`
 * to avoid type identity mismatches when consumers have a different astro version.
 *
 * `load` uses `any` for its context parameter because the actual `LoaderContext`
 * type from `astro/loaders` contains deep Vite/Rollup types that differ between
 * astro versions, causing "excessive stack depth" errors. Astro calls `load()`
 * internally — consumers never construct the context themselves.
 */
export interface SveltiaLoader {
  name: string;
  load: (context: any) => Promise<void>;
  schema?: any;
}

/**
 * Create a glob-based Loader from a resolved EntryCollection.
 */
function loaderFromCollection(collection: EntryCollection): SveltiaLoader {
  const extension = collection.extension || "md";
  const pattern = `**/*.${extension}`;
  const base = collection.folder;
  const isFrontmatter = frontmatterFormats.has(collection.format);

  const inner = glob({ pattern, base });

  return {
    name: "sveltia-cms",
    load: (context) => inner.load(context),
    schema: sveltiaSchema(collection.fields, {
      excludeBody: isFrontmatter,
    }),
  };
}

/**
 * Create an Astro content collection loader from a Sveltia CMS collection.
 *
 * Accepts either a **collection name** (string) or a full **collection object**.
 *
 * **String form** — looks up the collection from the CMS config passed to the
 * `sveltiaCms()` integration in `astro.config.mjs`. This is the recommended
 * approach: define your collections once in the Astro config and reference
 * them by name in `content.config.ts`.
 *
 * **Object form** — pass an `EntryCollection` object directly. Useful when
 * you want to use the loader independently of the integration, or share
 * collection definitions via a separate module.
 *
 * In both cases, the loader wraps Astro's built-in `glob()` loader and
 * auto-generates a Zod schema from the Sveltia CMS field definitions.
 *
 * @example String form (recommended)
 * ```ts
 * // astro.config.mjs — single source of truth
 * import { defineConfig } from 'astro/config';
 * import sveltiaCms from 'astro-sveltia-cms';
 *
 * export default defineConfig({
 *   integrations: [
 *     sveltiaCms({
 *       config: {
 *         backend: { name: 'github', repo: 'user/repo', branch: 'main' },
 *         collections: [
 *           {
 *             name: 'posts',
 *             folder: 'src/content/posts',
 *             create: true,
 *             fields: [
 *               { label: 'Title', name: 'title', widget: 'string' },
 *               { label: 'Date', name: 'date', widget: 'datetime' },
 *               { label: 'Body', name: 'body', widget: 'markdown' },
 *             ],
 *           },
 *         ],
 *       },
 *     }),
 *   ],
 * });
 * ```
 *
 * ```ts
 * // content.config.ts — just reference by name
 * import { defineCollection } from 'astro:content';
 * import { sveltiaLoader } from 'astro-sveltia-cms/loader';
 *
 * export const collections = {
 *   posts: defineCollection({ loader: sveltiaLoader('posts') }),
 * };
 * ```
 *
 * @example Object form
 * ```ts
 * // content.config.ts
 * import { defineCollection } from 'astro:content';
 * import { sveltiaLoader } from 'astro-sveltia-cms/loader';
 * import type { SveltiaEntryCollection } from 'astro-sveltia-cms/loader';
 *
 * const postsCollection = { ... } satisfies SveltiaEntryCollection;
 *
 * export const collections = {
 *   posts: defineCollection({ loader: sveltiaLoader(postsCollection) }),
 * };
 * ```
 */
export function sveltiaLoader(collectionOrName: string | EntryCollection): SveltiaLoader {
  // Object form: collection passed directly — resolve synchronously
  if (typeof collectionOrName !== "string") {
    return loaderFromCollection(collectionOrName);
  }

  // String form: look up collection from CMS config written by the integration.
  // The integration writes config.json to .astro/integrations/astro-sveltia-cms/
  // during astro:config:setup, which runs before content config is loaded.
  const name = collectionOrName;

  return {
    name: "sveltia-cms",

    schema: () => {
      const config = readCmsConfig();
      const collection = resolveCollection(config, name);
      const isFrontmatter = frontmatterFormats.has(collection.format);
      return sveltiaSchema(collection.fields, { excludeBody: isFrontmatter });
    },

    load: async (context) => {
      const config = readCmsConfig();
      const collection = resolveCollection(config, name);
      const extension = collection.extension || "md";
      const inner = glob({ pattern: `**/*.${extension}`, base: collection.folder });
      return inner.load(context);
    },
  };
}

/**
 * A Sveltia CMS entry collection definition (folder-based collection with `folder` and `fields`).
 * Re-exported from `@sveltia/cms` as `EntryCollection`.
 */
export type SveltiaEntryCollection = EntryCollection;

/**
 * A Sveltia CMS field definition.
 * Re-exported from `@sveltia/cms` as `Field`.
 */
export type SveltiaField = Field;

/**
 * The full Sveltia CMS configuration object.
 * Re-exported from `@sveltia/cms` as `CmsConfig`.
 */
export type SveltiaConfig = CmsConfig;
