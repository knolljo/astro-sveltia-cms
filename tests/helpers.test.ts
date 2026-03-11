import { describe, expect, it } from "vitest";
import { z } from "astro/zod";
import { getSelectValues, isOptionalField, selectValuesToZod } from "../src/loader.ts";
import type { Field } from "@sveltia/cms";

describe("isOptionalField", () => {
  it("returns true when required is false", () => {
    const field = { name: "x", widget: "string", required: false } as Field;
    expect(isOptionalField(field)).toBe(true);
  });

  it("returns false when required is true", () => {
    const field = { name: "x", widget: "string", required: true } as Field;
    expect(isOptionalField(field)).toBe(false);
  });

  it("returns false when required is absent", () => {
    const field = { name: "x", widget: "string" } as Field;
    expect(isOptionalField(field)).toBe(false);
  });

  it("returns false for hidden field (no required property on type)", () => {
    // HiddenField does not extend VisibleFieldProps so it has no `required`
    const field = { name: "h", widget: "hidden" } as Field;
    expect(isOptionalField(field)).toBe(false);
  });

  it("returns false when required is an array of locale codes", () => {
    // required can be boolean | LocaleCode[] — an array is truthy, not === false
    const field = {
      name: "x",
      widget: "string",
      required: ["en", "fr"],
    } as unknown as Field;
    expect(isOptionalField(field)).toBe(false);
  });
});

describe("getSelectValues", () => {
  it("returns bare string values unchanged", () => {
    expect(getSelectValues(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns bare number values unchanged", () => {
    expect(getSelectValues([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns bare null values unchanged", () => {
    expect(getSelectValues([null, "a"])).toEqual([null, "a"]);
  });

  it("extracts values from label/value objects", () => {
    const opts = [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ];
    expect(getSelectValues(opts)).toEqual(["a", "b"]);
  });

  it("extracts numeric values from label/value objects", () => {
    const opts = [
      { label: "One", value: 1 },
      { label: "Two", value: 2 },
    ];
    expect(getSelectValues(opts)).toEqual([1, 2]);
  });

  it("extracts null from label/value objects", () => {
    const opts = [{ label: "None", value: null }];
    expect(getSelectValues(opts)).toEqual([null]);
  });

  it("returns empty array for empty input", () => {
    expect(getSelectValues([])).toEqual([]);
  });
});

describe("selectValuesToZod", () => {
  it("produces z.enum for all-string values", () => {
    const schema = selectValuesToZod(["a", "b", "c"]);
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse("b").success).toBe(true);
    expect(schema.safeParse("d").success).toBe(false);
    expect(schema.safeParse(1).success).toBe(false);
  });

  it("produces z.literal for a single string value", () => {
    const schema = selectValuesToZod(["only"]);
    // single string → still z.enum(["only"]) since allStrings is true
    expect(schema.safeParse("only").success).toBe(true);
    expect(schema.safeParse("other").success).toBe(false);
  });

  it("produces z.literal for a single non-string value", () => {
    const schema = selectValuesToZod([42]);
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse(43).success).toBe(false);
    expect(schema.safeParse("42").success).toBe(false);
  });

  it("produces z.union of literals for all-number values", () => {
    const schema = selectValuesToZod([1, 2, 3]);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(3).success).toBe(true);
    expect(schema.safeParse(4).success).toBe(false);
    expect(schema.safeParse("1").success).toBe(false);
  });

  it("produces z.union including z.null() for null values", () => {
    const schema = selectValuesToZod([null]);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("").success).toBe(false);
  });

  it("produces z.union for mixed string/number/null values", () => {
    const schema = selectValuesToZod(["a", 1, null]);
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("b").success).toBe(false);
    expect(schema.safeParse(2).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it("returns z.any() for empty values", () => {
    const schema = selectValuesToZod([]);
    expect(schema.safeParse("anything").success).toBe(true);
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
  });

  it("is assignable to ZodType", () => {
    const schema: z.ZodType = selectValuesToZod(["x"]);
    expect(schema).toBeDefined();
  });
});
