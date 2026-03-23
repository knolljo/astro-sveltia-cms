import type { Field } from "@sveltia/cms";
import { getWidget, isBodyField } from "./field-types.js";
import type { MultipleField, ObjectField, ListField, RelationField } from "./field-types.js";

export const IMAGE_IMPORT_PREFIX = "__ASTRO_IMAGE_";

export function normalizeImagePath(val: string): string {
  if (!val) return val;
  if (
    val.includes("://") ||
    val.startsWith("/") ||
    val.startsWith(".") ||
    val.startsWith("~") ||
    val.startsWith("@")
  )
    return val;
  return `./${val}`;
}

function prefixImageValue(value: unknown, field: Field): unknown {
  const isMultiple = (field as MultipleField).multiple;
  if (isMultiple && Array.isArray(value)) {
    return value.map((v) =>
      typeof v === "string" && v ? `${IMAGE_IMPORT_PREFIX}${normalizeImagePath(v)}` : v,
    );
  }
  if (typeof value === "string" && value) {
    return `${IMAGE_IMPORT_PREFIX}${normalizeImagePath(value)}`;
  }
  return value;
}

function transformRelationValue(
  value: unknown,
  collection: string,
  isMultiple: boolean | undefined,
): unknown {
  if (isMultiple && Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" && v ? { collection, id: v } : v));
  }
  if (typeof value === "string" && value) {
    return { collection, id: value };
  }
  return value;
}

export function transformFieldValues(
  data: Record<string, unknown>,
  fields: Field[],
  excludeBody: boolean,
): Record<string, unknown> {
  const result = { ...data };

  for (const field of fields) {
    if (excludeBody && isBodyField(field)) continue;
    if (!(field.name in result) || result[field.name] == null) continue;

    const widget = getWidget(field);

    if (widget === "image") {
      result[field.name] = prefixImageValue(result[field.name], field);
    } else if (widget === "relation") {
      const { collection, multiple } = field as RelationField;
      result[field.name] = transformRelationValue(result[field.name], collection, multiple);
    } else if (widget === "object") {
      const { fields: subFields, types, typeKey = "type" } = field as ObjectField;
      const obj = result[field.name];
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        if (types) {
          const variant = types.find((t) => t.name === (obj as Record<string, unknown>)[typeKey]);
          if (variant?.fields) {
            result[field.name] = transformFieldValues(
              obj as Record<string, unknown>,
              variant.fields,
              false,
            );
          }
        } else if (subFields) {
          result[field.name] = transformFieldValues(obj as Record<string, unknown>, subFields, false);
        }
      }
    } else if (widget === "list") {
      const { field: singleField, fields: subFields, types, typeKey = "type" } = field as ListField;
      const arr = result[field.name];
      if (Array.isArray(arr)) {
        if (types) {
          result[field.name] = arr.map((item) => {
            if (typeof item !== "object" || item === null) return item;
            const variant = types.find(
              (t) => t.name === (item as Record<string, unknown>)[typeKey],
            );
            return variant?.fields
              ? transformFieldValues(item as Record<string, unknown>, variant.fields, false)
              : item;
          });
        } else if (subFields) {
          result[field.name] = arr.map((item) =>
            typeof item === "object" && item !== null
              ? transformFieldValues(item as Record<string, unknown>, subFields, false)
              : item,
          );
        } else if (singleField) {
          if (getWidget(singleField) === "image") {
            result[field.name] = arr.map((v) => prefixImageValue(v, singleField));
          } else if (getWidget(singleField) === "relation") {
            const { collection, multiple } = singleField as RelationField;
            // The list handler already unwrapped the array, so the full array is passed
            // to transformRelationValue — default to multiple so it maps over elements.
            result[field.name] = transformRelationValue(arr, collection, multiple ?? true);
          }
        }
      }
    }
  }

  return result;
}
