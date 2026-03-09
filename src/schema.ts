import { z } from "astro/zod";
import type { Field, SelectFieldValue } from "@sveltia/cms";

/**
 * File formats that store the document body separately from frontmatter.
 * The default format (undefined) is yaml-frontmatter.
 */
export const frontmatterFormats = new Set([
  "yaml-frontmatter",
  "toml-frontmatter",
  "json-frontmatter",
  undefined,
]);

// Narrow helper interfaces — used to safely access widget-specific properties
// without scattering `as` casts throughout the code.

interface NumberField {
  value_type?: string;
}

interface MultipleField {
  multiple?: boolean;
}

interface SelectField extends MultipleField {
  options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[];
}

interface CodeField {
  output_code_only?: boolean;
  keys?: { code: string; lang: string };
}

interface HiddenField {
  default?: unknown;
}

interface ObjectField {
  fields?: Field[];
  types?: VariantType[];
  typeKey?: string;
}

interface ListField {
  field?: Field;
  fields?: Field[];
  types?: VariantType[];
  typeKey?: string;
}

interface VariantType {
  name: string;
  fields?: Field[];
}

export function isOptionalField(field: Field): boolean {
  if (!("required" in field)) return false;
  // `required` can be boolean or LocaleCode[].
  // An empty locale array means "required in no locale", which is treated as optional.
  if (Array.isArray(field.required)) return field.required.length === 0;
  return field.required === false;
}

export function getSelectValues(
  options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[],
): SelectFieldValue[] {
  if (options.length === 0) return [];
  const first = options[0];
  if (typeof first === "object" && first !== null && "value" in first) {
    return (options as { label: string; value: SelectFieldValue }[]).map((o) => o.value);
  }
  return options as SelectFieldValue[];
}

export function selectValuesToZod(values: SelectFieldValue[]): z.ZodTypeAny {
  if (values.length === 0) return z.any();

  const allStrings = values.every((v) => typeof v === "string");
  if (allStrings) {
    if (values.length === 1) return z.literal(values[0] as string);
    return z.enum(values as [string, ...string[]]);
  }

  const literals = values.map((v) => {
    if (v === null) return z.null();
    if (typeof v === "number") return z.literal(v);
    return z.literal(v as string);
  });

  if (literals.length === 1) return literals[0];
  return z.union(literals as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

type ZodObjectShape = z.ZodObject<Record<string, z.ZodTypeAny>>;

function buildVariantSchemas(variants: VariantType[], typeKey: string): ZodObjectShape[] {
  return variants.map((variant) => {
    const shape: Record<string, z.ZodTypeAny> = {
      [typeKey]: z.literal(variant.name),
    };
    for (const subField of variant.fields ?? []) {
      const subSchema = fieldToZod(subField);
      shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
    }
    return z.object(shape);
  });
}

function variantsToDiscriminatedUnion(variants: VariantType[], typeKey: string): z.ZodTypeAny {
  const schemas = buildVariantSchemas(variants, typeKey);
  if (schemas.length === 0) return z.object({});
  if (schemas.length === 1) return schemas[0];
  return z.discriminatedUnion(
    typeKey,
    schemas as [ZodObjectShape, ZodObjectShape, ...ZodObjectShape[]],
  );
}

function numberFieldToZod(field: Field): z.ZodTypeAny {
  const valueType = (field as NumberField).value_type ?? "int";
  if (valueType === "int/string" || valueType === "float/string") {
    return z.union([z.number(), z.string()]);
  }
  return z.number();
}

function fileFieldToZod(field: Field): z.ZodTypeAny {
  return (field as MultipleField).multiple ? z.array(z.string()) : z.string();
}

function selectFieldToZod(field: Field): z.ZodTypeAny {
  const { options, multiple } = field as SelectField;
  const values = getSelectValues(options);
  const valueSchema = selectValuesToZod(values);
  return multiple ? z.array(valueSchema) : valueSchema;
}

function codeFieldToZod(field: Field): z.ZodTypeAny {
  const { output_code_only, keys = { code: "code", lang: "lang" } } = field as CodeField;
  if (output_code_only) return z.string();
  return z.object({ [keys.code]: z.string(), [keys.lang]: z.string() });
}

/**
 * Infers the Zod type for a `hidden` field from its `default` value's JS type.
 * Falls back to `z.any()` when no default is provided, since a hidden field
 * without a default has no statically known type. This is a best-effort
 * approximation: it assumes the stored value always matches the default's type.
 */
function hiddenFieldToZod(field: Field): z.ZodTypeAny {
  const { default: defaultValue } = field as HiddenField;
  switch (typeof defaultValue) {
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

function objectFieldToZod(field: Field): z.ZodTypeAny {
  const { fields, types, typeKey = "type" } = field as ObjectField;

  if (types) {
    return variantsToDiscriminatedUnion(types, typeKey);
  }

  if (fields) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const subField of fields) {
      const subSchema = fieldToZod(subField);
      shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
    }
    return z.object(shape);
  }

  return z.object({});
}

function listFieldToZod(field: Field): z.ZodTypeAny {
  const { field: singleField, fields, types, typeKey = "type" } = field as ListField;

  if (types) {
    if (types.length === 0) return z.array(z.any());
    return z.array(variantsToDiscriminatedUnion(types, typeKey));
  }

  if (fields) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const subField of fields) {
      const subSchema = fieldToZod(subField);
      shape[subField.name] = isOptionalField(subField) ? subSchema.optional() : subSchema;
    }
    return z.array(z.object(shape));
  }

  if (singleField) {
    return z.array(fieldToZod(singleField));
  }

  return z.array(z.string());
}

export function fieldToZod(field: Field): z.ZodTypeAny {
  const widget = "widget" in field ? field.widget : "string";

  switch (widget) {
    case "string":
    case "text":
    case "color":
    case "map":
    case "uuid":
    case "compute":
    case "markdown":
    case "richtext":
      return z.string();

    case "number":
      return numberFieldToZod(field);

    case "boolean":
      return z.boolean();

    case "datetime":
      return z.coerce.date();

    case "image":
    case "file":
      return fileFieldToZod(field);

    case "select":
      return selectFieldToZod(field);

    case "relation":
      return fileFieldToZod(field); // same shape: single string or string[]

    case "keyvalue":
      return z.record(z.string(), z.string());

    case "code":
      return codeFieldToZod(field);

    case "hidden":
      return hiddenFieldToZod(field);

    case "object":
      return objectFieldToZod(field);

    case "list":
      return listFieldToZod(field);

    default:
      return z.any();
  }
}

export function sveltiaSchema(
  fields: Field[],
  options?: { excludeBody?: boolean },
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const excludeBody = options?.excludeBody ?? true;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const isBodyField =
      excludeBody &&
      field.name === "body" &&
      "widget" in field &&
      (field.widget === "markdown" || field.widget === "richtext");

    if (isBodyField) continue;

    const schema = fieldToZod(field);
    shape[field.name] = isOptionalField(field) ? schema.optional() : schema;
  }

  return z.object(shape);
}
