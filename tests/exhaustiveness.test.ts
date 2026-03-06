/**
 * Future-proofing tests: detect when @sveltia/cms evolves in ways that
 * require updates to fieldToZod.
 *
 * Strategy 1 — Compile-time exhaustiveness guard (Part A):
 *   A Record<BuiltInFieldType, true> constant that becomes a TypeScript
 *   compile error the moment @sveltia/cms adds or removes a widget type
 *   from BuiltInFieldType. Caught by `tsc` / type-checking, not at runtime.
 *
 * Strategy 2 — JSON Schema canary (Part B + C):
 *   At runtime, reads the machine-readable JSON Schema shipped with
 *   @sveltia/cms and:
 *   B) asserts that every widget type in the schema is present in our
 *      KNOWN_WIDGET_TYPES list — fails if a new type is added to the
 *      package before we update the code.
 *   C) asserts that every known widget type has a dedicated test in
 *      field-to-zod.test.ts — fails if we add a type to the list but
 *      forget to write the test.
 *
 * When either canary fires, the failure message tells you exactly what
 * changed and what needs updating.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { BuiltInFieldType } from "@sveltia/cms";

// This object must have exactly one key per member of BuiltInFieldType.
//
// If @sveltia/cms ADDS a widget type to BuiltInFieldType, TypeScript will
// report: "Property '<newtype>' is missing in type ... but required in type
// 'Record<BuiltInFieldType, true>'."
//
// If @sveltia/cms REMOVES a widget type, TypeScript will report: "Object
// literal may only specify known properties, and '<removedtype>' does not
// exist in type 'Record<BuiltInFieldType, true>'."
//
// Neither error is reachable at runtime — this is a pure type-level check.

const _exhaustiveWidgetCoverage: Record<BuiltInFieldType, true> = {
  boolean: true,
  code: true,
  color: true,
  compute: true,
  datetime: true,
  file: true,
  hidden: true,
  image: true,
  keyvalue: true,
  list: true,
  map: true,
  markdown: true,
  number: true,
  object: true,
  relation: true,
  richtext: true,
  select: true,
  string: true,
  text: true,
  uuid: true,
};

// Suppress "declared but never read" — the value is only here for the type check.
void _exhaustiveWidgetCoverage;

// Keep a runtime mirror of the same set so Part B and C can use it.
const KNOWN_WIDGET_TYPES = Object.keys(_exhaustiveWidgetCoverage) as BuiltInFieldType[];

function loadSveltiaSchema(): {
  definitions: {
    CustomField: {
      properties: {
        widget: {
          not: { enum: string[] };
        };
      };
    };
  };
} {
  // Vitest does not support import.meta.resolve, so we resolve the schema
  // relative to the project root (process.cwd() in Vitest = workspace root).
  const schemaPath = join(process.cwd(), "node_modules/@sveltia/cms/schema/sveltia-cms.json");
  return JSON.parse(readFileSync(schemaPath, "utf-8"));
}

describe("exhaustiveness — JSON Schema canary (schema → our list)", () => {
  it("loads the @sveltia/cms JSON Schema without error", () => {
    expect(() => loadSveltiaSchema()).not.toThrow();
  });

  it("every widget type in the JSON Schema is present in KNOWN_WIDGET_TYPES", () => {
    const schema = loadSveltiaSchema();
    const schemaTypes: string[] = schema.definitions.CustomField.properties.widget.not.enum;

    const unknown = schemaTypes.filter((t) => !KNOWN_WIDGET_TYPES.includes(t as BuiltInFieldType));

    expect(
      unknown,
      [
        `New widget type(s) found in @sveltia/cms that are not yet handled by fieldToZod:`,
        `  ${unknown.map((t) => JSON.stringify(t)).join(", ")}`,
        ``,
        `To fix this failure:`,
        `  1. Add a case to the fieldToZod() switch in src/schema.ts`,
        `  2. Add the type to _exhaustiveWidgetCoverage in tests/exhaustiveness.test.ts`,
        `  3. Add tests in tests/field-to-zod.test.ts`,
      ].join("\n"),
    ).toHaveLength(0);
  });

  it("every type in KNOWN_WIDGET_TYPES is still present in the JSON Schema", () => {
    const schema = loadSveltiaSchema();
    const schemaTypes: string[] = schema.definitions.CustomField.properties.widget.not.enum;

    const removed = KNOWN_WIDGET_TYPES.filter((t) => !schemaTypes.includes(t));

    expect(
      removed,
      [
        `Widget type(s) removed from @sveltia/cms that are still in KNOWN_WIDGET_TYPES:`,
        `  ${removed.map((t) => JSON.stringify(t)).join(", ")}`,
        ``,
        `To fix this failure:`,
        `  1. Remove the case from fieldToZod() in src/schema.ts (if appropriate)`,
        `  2. Remove the type from _exhaustiveWidgetCoverage in tests/exhaustiveness.test.ts`,
        `  3. Remove or update the corresponding tests in tests/field-to-zod.test.ts`,
      ].join("\n"),
    ).toHaveLength(0);
  });

  it("the JSON Schema widget list and KNOWN_WIDGET_TYPES are identical sets", () => {
    const schema = loadSveltiaSchema();
    const schemaSet = new Set<string>(schema.definitions.CustomField.properties.widget.not.enum);
    const knownSet = new Set<string>(KNOWN_WIDGET_TYPES);

    expect(schemaSet).toEqual(knownSet);
  });
});

describe("exhaustiveness — coverage cross-check (our list → tests)", () => {
  const testFilePath = join(dirname(fileURLToPath(import.meta.url)), "field-to-zod.test.ts");
  const testFileContent = readFileSync(testFilePath, "utf-8");

  for (const widgetType of KNOWN_WIDGET_TYPES) {
    it(`field-to-zod.test.ts has a describe block for widget: "${widgetType}"`, () => {
      const pattern = new RegExp(`widget.*"${widgetType}"`);

      expect(
        pattern.test(testFileContent),
        [
          `No describe block found for widget type "${widgetType}" in tests/field-to-zod.test.ts.`,
          ``,
          `To fix this failure, add a describe block like:`,
          `  describe('fieldToZod — widget: "${widgetType}"', () => { ... })`,
        ].join("\n"),
      ).toBe(true);
    });
  }
});
