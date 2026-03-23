import type { Field, SelectFieldValue } from "@sveltia/cms";

// Narrow helper interfaces — used to safely access widget-specific properties
// without scattering `as` casts throughout the code.

export interface NumberField {
  value_type?: string;
}

export interface MultipleField {
  multiple?: boolean;
}

export interface SelectField extends MultipleField {
  options: SelectFieldValue[] | { label: string; value: SelectFieldValue }[];
}

export interface CodeField {
  output_code_only?: boolean;
  keys?: { code: string; lang: string };
}

export interface HiddenField {
  default?: unknown;
}

export interface ObjectField {
  fields?: Field[];
  types?: VariantType[];
  typeKey?: string;
}

export interface RelationField extends MultipleField {
  collection: string;
}

export interface ListField {
  field?: Field;
  fields?: Field[];
  types?: VariantType[];
  typeKey?: string;
}

export interface VariantType {
  name: string;
  fields?: Field[];
}

export function getWidget(field: Field): string {
  return "widget" in field && field.widget ? field.widget : "string";
}

export function isBodyField(field: Field): boolean {
  const widget = getWidget(field);
  return field.name === "body" && (widget === "markdown" || widget === "richtext");
}
