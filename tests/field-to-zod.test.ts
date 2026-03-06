import { describe, expect, it } from "vitest";
import { z } from "astro/zod";
import { fieldToZod } from "../src/loader.ts";
import type { Field } from "@sveltia/cms";

function accepts(schema: z.ZodTypeAny, value: unknown): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Expected schema to accept ${JSON.stringify(value)}, but got: ${result.error.message}`,
    );
  }
}

function rejects(schema: z.ZodTypeAny, value: unknown): void {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(`Expected schema to reject ${JSON.stringify(value)}, but it was accepted`);
  }
}

describe('fieldToZod — widget: "string"', () => {
  it("accepts a string", () => {
    accepts(fieldToZod({ name: "x", widget: "string" }), "hello");
  });
  it("rejects a number", () => {
    rejects(fieldToZod({ name: "x", widget: "string" }), 42);
  });
  it("rejects null", () => {
    rejects(fieldToZod({ name: "x", widget: "string" }), null);
  });
});

describe('fieldToZod — widget: "text"', () => {
  it("accepts a string", () => {
    accepts(fieldToZod({ name: "x", widget: "text" }), "multi\nline");
  });
  it("rejects a number", () => {
    rejects(fieldToZod({ name: "x", widget: "text" }), 0);
  });
});

describe('fieldToZod — widget: "color"', () => {
  it("accepts a css color string", () => {
    accepts(fieldToZod({ name: "c", widget: "color" }), "#ff0000");
  });
  it("rejects a boolean", () => {
    rejects(fieldToZod({ name: "c", widget: "color" }), true);
  });
});

describe('fieldToZod — widget: "map"', () => {
  it("accepts a string (geojson etc.)", () => {
    accepts(fieldToZod({ name: "m", widget: "map" }), '{"type":"Point"}');
  });
  it("rejects an object", () => {
    rejects(fieldToZod({ name: "m", widget: "map" }), { type: "Point" });
  });
});

describe('fieldToZod — widget: "uuid"', () => {
  it("accepts a uuid string", () => {
    accepts(fieldToZod({ name: "id", widget: "uuid" }), "123e4567-e89b-12d3-a456-426614174000");
  });
  it("rejects a number", () => {
    rejects(fieldToZod({ name: "id", widget: "uuid" }), 123);
  });
});

describe('fieldToZod — widget: "compute"', () => {
  it("accepts a string", () => {
    accepts(fieldToZod({ name: "slug", widget: "compute", value: "{{title}}" }), "my-post");
  });
  it("rejects an array", () => {
    rejects(fieldToZod({ name: "slug", widget: "compute", value: "{{title}}" }), ["a"]);
  });
});

describe('fieldToZod — widget: "markdown"', () => {
  it("accepts a markdown string", () => {
    accepts(fieldToZod({ name: "content", widget: "markdown" }), "# Hello\nWorld");
  });
  it("rejects a number", () => {
    rejects(fieldToZod({ name: "content", widget: "markdown" }), 99);
  });
});

describe('fieldToZod — widget: "richtext"', () => {
  it("accepts a rich text string", () => {
    accepts(fieldToZod({ name: "body", widget: "richtext" }), "<p>Hello</p>");
  });
  it("rejects an object", () => {
    rejects(fieldToZod({ name: "body", widget: "richtext" }), { html: "<p>" });
  });
});

describe("fieldToZod — no widget (StringField default)", () => {
  it("accepts a string when widget is absent", () => {
    // StringField is the only type where widget is optional
    const field = { name: "title" } as Field;
    accepts(fieldToZod(field), "My Title");
  });
  it("rejects a number when widget is absent", () => {
    const field = { name: "title" } as Field;
    rejects(fieldToZod(field), 42);
  });
});

describe('fieldToZod — widget: "number"', () => {
  it("default (no value_type) → z.number()", () => {
    const s = fieldToZod({ name: "n", widget: "number" });
    accepts(s, 5);
    rejects(s, "5");
    rejects(s, true);
  });

  it('value_type: "int" → z.number()', () => {
    const s = fieldToZod({ name: "n", widget: "number", value_type: "int" });
    accepts(s, 10);
    rejects(s, "10");
  });

  it('value_type: "float" → z.number()', () => {
    const s = fieldToZod({ name: "n", widget: "number", value_type: "float" });
    accepts(s, 3.14);
    rejects(s, "3.14");
  });

  it('value_type: "int/string" → z.union([z.number(), z.string()])', () => {
    const s = fieldToZod({ name: "n", widget: "number", value_type: "int/string" });
    accepts(s, 42);
    accepts(s, "42");
    rejects(s, true);
    rejects(s, null);
  });

  it('value_type: "float/string" → z.union([z.number(), z.string()])', () => {
    const s = fieldToZod({ name: "n", widget: "number", value_type: "float/string" });
    accepts(s, 1.5);
    accepts(s, "1.5");
    rejects(s, false);
  });
});

describe('fieldToZod — widget: "boolean"', () => {
  it("accepts true and false", () => {
    const s = fieldToZod({ name: "b", widget: "boolean" });
    accepts(s, true);
    accepts(s, false);
  });
  it('rejects the string "true"', () => {
    rejects(fieldToZod({ name: "b", widget: "boolean" }), "true");
  });
  it("rejects 1", () => {
    rejects(fieldToZod({ name: "b", widget: "boolean" }), 1);
  });
});

describe('fieldToZod — widget: "datetime"', () => {
  it("accepts an ISO date string (coerced to Date)", () => {
    const s = fieldToZod({ name: "d", widget: "datetime" });
    const result = s.safeParse("2024-01-15");
    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Date);
  });

  it("accepts a Date object", () => {
    accepts(fieldToZod({ name: "d", widget: "datetime" }), new Date());
  });

  it("accepts a numeric timestamp", () => {
    // z.coerce.date() coerces numbers too
    accepts(fieldToZod({ name: "d", widget: "datetime" }), Date.now());
  });

  it("rejects an unparseable string", () => {
    rejects(fieldToZod({ name: "d", widget: "datetime" }), "not-a-date");
  });
});

describe('fieldToZod — widget: "image"', () => {
  it("accepts a path string when multiple is absent", () => {
    accepts(fieldToZod({ name: "img", widget: "image" }), "/uploads/photo.jpg");
  });
  it("rejects an array when multiple is absent", () => {
    rejects(fieldToZod({ name: "img", widget: "image" }), ["/a.jpg"]);
  });

  it("accepts an array of strings when multiple: true", () => {
    const s = fieldToZod({ name: "img", widget: "image", multiple: true });
    accepts(s, ["/a.jpg", "/b.jpg"]);
    accepts(s, []);
  });
  it("rejects a string when multiple: true", () => {
    rejects(fieldToZod({ name: "img", widget: "image", multiple: true }), "/a.jpg");
  });

  it("accepts a single string when multiple: false (explicit)", () => {
    accepts(fieldToZod({ name: "img", widget: "image", multiple: false }), "/a.jpg");
  });
});

describe('fieldToZod — widget: "file"', () => {
  it("single file → z.string()", () => {
    accepts(fieldToZod({ name: "f", widget: "file" }), "/docs/resume.pdf");
    rejects(fieldToZod({ name: "f", widget: "file" }), 42);
  });

  it("multiple files → z.array(z.string())", () => {
    const s = fieldToZod({ name: "f", widget: "file", multiple: true });
    accepts(s, ["a.pdf", "b.pdf"]);
    rejects(s, "single.pdf");
  });
});

describe('fieldToZod — widget: "select"', () => {
  it("string options → z.enum()", () => {
    const s = fieldToZod({ name: "s", widget: "select", options: ["a", "b", "c"] });
    accepts(s, "a");
    accepts(s, "c");
    rejects(s, "d");
    rejects(s, 1);
  });

  it("string options with multiple → z.array(z.enum())", () => {
    const s = fieldToZod({
      name: "s",
      widget: "select",
      options: ["x", "y", "z"],
      multiple: true,
    });
    accepts(s, ["x", "y"]);
    accepts(s, []);
    rejects(s, "x"); // not wrapped in array
    rejects(s, ["x", "w"]); // "w" not in enum
  });

  it("label/value options → extracts values for z.enum()", () => {
    const s = fieldToZod({
      name: "s",
      widget: "select",
      options: [
        { label: "Alpha", value: "alpha" },
        { label: "Beta", value: "beta" },
      ],
    });
    accepts(s, "alpha");
    accepts(s, "beta");
    rejects(s, "Alpha"); // label, not value
    rejects(s, "gamma");
  });

  it("label/value with multiple → z.array(z.enum())", () => {
    const s = fieldToZod({
      name: "s",
      widget: "select",
      options: [
        { label: "One", value: "one" },
        { label: "Two", value: "two" },
      ],
      multiple: true,
    });
    accepts(s, ["one", "two"]);
    rejects(s, ["One"]); // label, not value
  });

  it("numeric options → z.union of literals", () => {
    const s = fieldToZod({ name: "s", widget: "select", options: [1, 2, 3] });
    accepts(s, 1);
    accepts(s, 3);
    rejects(s, 4);
    rejects(s, "1");
  });

  it("single numeric option → z.literal", () => {
    const s = fieldToZod({ name: "s", widget: "select", options: [99] });
    accepts(s, 99);
    rejects(s, 100);
    rejects(s, "99");
  });

  it("mixed string/number/null options → z.union of literals", () => {
    const s = fieldToZod({ name: "s", widget: "select", options: ["yes", 0, null] });
    accepts(s, "yes");
    accepts(s, 0);
    accepts(s, null);
    rejects(s, "no");
    rejects(s, 1);
    rejects(s, undefined);
  });

  it("mixed multiple → z.array(z.union(...))", () => {
    const s = fieldToZod({
      name: "s",
      widget: "select",
      options: ["a", 1],
      multiple: true,
    });
    accepts(s, ["a", 1]);
    accepts(s, [1]);
    rejects(s, ["b"]);
  });

  it("empty options → z.any()", () => {
    const s = fieldToZod({ name: "s", widget: "select", options: [] });
    accepts(s, "anything");
    accepts(s, 42);
    accepts(s, null);
  });
});

describe('fieldToZod — widget: "relation"', () => {
  it("single → z.string()", () => {
    const s = fieldToZod({ name: "r", widget: "relation", collection: "authors" });
    accepts(s, "some-slug");
    rejects(s, 42);
  });

  it("multiple → z.array(z.string())", () => {
    const s = fieldToZod({
      name: "r",
      widget: "relation",
      collection: "tags",
      multiple: true,
    });
    accepts(s, ["tag-a", "tag-b"]);
    rejects(s, "single");
  });
});

describe('fieldToZod — widget: "keyvalue"', () => {
  it("accepts a string-keyed string-valued record", () => {
    const s = fieldToZod({ name: "kv", widget: "keyvalue" });
    accepts(s, { foo: "bar", baz: "qux" });
    accepts(s, {});
  });

  it("rejects non-string values", () => {
    rejects(fieldToZod({ name: "kv", widget: "keyvalue" }), { foo: 42 });
  });

  it("rejects an array", () => {
    rejects(fieldToZod({ name: "kv", widget: "keyvalue" }), ["a", "b"]);
  });
});

describe('fieldToZod — widget: "code"', () => {
  it("default → z.object({ code, lang })", () => {
    const s = fieldToZod({ name: "c", widget: "code" });
    accepts(s, { code: "console.log()", lang: "javascript" });
    rejects(s, "raw string");
    rejects(s, { code: "x" }); // missing lang
    rejects(s, { lang: "js" }); // missing code
  });

  it("output_code_only: true → z.string()", () => {
    const s = fieldToZod({ name: "c", widget: "code", output_code_only: true });
    accepts(s, "let x = 1;");
    rejects(s, { code: "let x = 1;", lang: "js" });
  });

  it("custom keys → uses those key names", () => {
    const s = fieldToZod({
      name: "c",
      widget: "code",
      keys: { code: "src", lang: "language" },
    });
    accepts(s, { src: "const x = 1", language: "ts" });
    rejects(s, { code: "const x = 1", lang: "ts" }); // old default keys
    rejects(s, { src: "x" }); // missing language
  });

  it("output_code_only: false with custom keys → uses object with custom keys", () => {
    const s = fieldToZod({
      name: "c",
      widget: "code",
      output_code_only: false,
      keys: { code: "content", lang: "syntax" },
    });
    accepts(s, { content: "x = 1", syntax: "python" });
    rejects(s, "string");
  });
});

describe('fieldToZod — widget: "hidden"', () => {
  it("string default → z.string()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden", default: "hello" });
    accepts(s, "world");
    rejects(s, 42);
  });

  it("number default → z.number()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden", default: 42 });
    accepts(s, 0);
    accepts(s, 3.14);
    rejects(s, "42");
  });

  it("boolean default → z.boolean()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden", default: true });
    accepts(s, false);
    rejects(s, "true");
  });

  it("object default → z.any()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden", default: { foo: "bar" } });
    accepts(s, { anything: true });
    accepts(s, "even strings");
    accepts(s, null);
  });

  it("array default → z.any()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden", default: [1, 2] });
    accepts(s, [1, 2, 3]);
    accepts(s, "string too");
  });

  it("no default → z.any()", () => {
    const s = fieldToZod({ name: "h", widget: "hidden" });
    accepts(s, "anything");
    accepts(s, 999);
    accepts(s, null);
  });
});

describe('fieldToZod — widget: "object"', () => {
  it("with fields → z.object() with correct shape", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      fields: [
        { name: "title", widget: "string" },
        { name: "count", widget: "number" },
      ],
    });
    accepts(s, { title: "hello", count: 5 });
    rejects(s, { title: "hello", count: "five" });
    rejects(s, { title: "hello" }); // missing count
    rejects(s, "string");
  });

  it("with optional subfield", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      fields: [
        { name: "title", widget: "string" },
        { name: "subtitle", widget: "string", required: false },
      ],
    });
    accepts(s, { title: "a" }); // subtitle is optional
    accepts(s, { title: "a", subtitle: "b" });
    rejects(s, {}); // title is required
  });

  it("empty fields → z.object({})", () => {
    const s = fieldToZod({ name: "o", widget: "object", fields: [] });
    // z.object({}) accepts any object (strict mode would reject extra keys, but default doesn't)
    accepts(s, {});
    accepts(s, { extra: "ignored" });
    rejects(s, "string");
  });

  it("no fields or types → z.object({})", () => {
    // Cast needed: the TypeScript type requires fields or types, but we test runtime behaviour
    const s = fieldToZod({ name: "o", widget: "object" } as Field);
    accepts(s, {});
  });

  it("with variable types → z.discriminatedUnion", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      types: [
        {
          name: "paragraph",
          fields: [{ name: "text", widget: "string" }],
        },
        {
          name: "image",
          fields: [{ name: "src", widget: "image" }],
        },
      ],
    });
    accepts(s, { type: "paragraph", text: "hello" });
    accepts(s, { type: "image", src: "/img.jpg" });
    rejects(s, { type: "video", src: "/vid.mp4" }); // unknown type
    rejects(s, { text: "hello" }); // missing type discriminant
    rejects(s, { type: "paragraph" }); // missing text
  });

  it("variable types with custom typeKey", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      typeKey: "kind",
      types: [
        { name: "foo", fields: [{ name: "val", widget: "string" }] },
        { name: "bar", fields: [{ name: "num", widget: "number" }] },
      ],
    });
    accepts(s, { kind: "foo", val: "hello" });
    accepts(s, { kind: "bar", num: 42 });
    rejects(s, { type: "foo", val: "hello" }); // wrong discriminant key
    rejects(s, { kind: "baz", val: "x" }); // unknown kind
  });

  it("single variable type → returns the object directly (no discriminatedUnion)", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      types: [{ name: "only", fields: [{ name: "x", widget: "string" }] }],
    });
    // Parsed as z.object({ type: z.literal("only"), x: z.string() })
    accepts(s, { type: "only", x: "value" });
    rejects(s, { type: "other", x: "value" });
  });

  it("empty types array → z.object({})", () => {
    const s = fieldToZod({ name: "o", widget: "object", types: [] });
    accepts(s, {});
  });

  it("nested objects (recursion depth 2)", () => {
    const s = fieldToZod({
      name: "outer",
      widget: "object",
      fields: [
        {
          name: "inner",
          widget: "object",
          fields: [{ name: "deep", widget: "string" }],
        },
      ],
    });
    accepts(s, { inner: { deep: "value" } });
    rejects(s, { inner: { deep: 42 } });
    rejects(s, { inner: "not-an-object" });
  });

  it("variable type with optional subfields", () => {
    const s = fieldToZod({
      name: "o",
      widget: "object",
      types: [
        {
          name: "card",
          fields: [
            { name: "title", widget: "string" },
            { name: "subtitle", widget: "string", required: false },
          ],
        },
        {
          name: "banner",
          fields: [{ name: "url", widget: "string" }],
        },
      ],
    });
    accepts(s, { type: "card", title: "Hello" }); // subtitle optional
    accepts(s, { type: "card", title: "Hello", subtitle: "Sub" });
    rejects(s, { type: "card" }); // title required
  });
});

describe('fieldToZod — widget: "list"', () => {
  it("simple list (no subfield) → z.array(z.string())", () => {
    const s = fieldToZod({ name: "l", widget: "list" });
    accepts(s, ["a", "b", "c"]);
    accepts(s, []);
    rejects(s, ["a", 1]); // 1 is not a string
    rejects(s, "not-array");
  });

  it("list with single field (string) → z.array(z.string())", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      field: { name: "tag", widget: "string" },
    });
    accepts(s, ["one", "two"]);
    rejects(s, [1, 2]);
  });

  it("list with single field (number) → z.array(z.number())", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      field: { name: "score", widget: "number" },
    });
    accepts(s, [1, 2, 3]);
    rejects(s, ["1", "2"]);
  });

  it("list with single field (boolean) → z.array(z.boolean())", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      field: { name: "flag", widget: "boolean" },
    });
    accepts(s, [true, false, true]);
    rejects(s, [true, 1]);
  });

  it("list with multiple fields → z.array(z.object(...))", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      fields: [
        { name: "name", widget: "string" },
        { name: "url", widget: "string" },
      ],
    });
    accepts(s, [
      { name: "Site A", url: "https://a.com" },
      { name: "Site B", url: "https://b.com" },
    ]);
    accepts(s, []);
    rejects(s, [{ name: "A" }]); // missing url
    rejects(s, [{ name: "A", url: 42 }]); // url not a string
  });

  it("list with multiple fields including optional", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      fields: [
        { name: "title", widget: "string" },
        { name: "description", widget: "string", required: false },
      ],
    });
    accepts(s, [{ title: "A" }]); // description optional
    accepts(s, [{ title: "A", description: "desc" }]);
    rejects(s, [{}]); // title required
  });

  it("list with variable types → z.array(z.discriminatedUnion(...))", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      types: [
        { name: "text", fields: [{ name: "body", widget: "string" }] },
        { name: "image", fields: [{ name: "src", widget: "image" }] },
      ],
    });
    accepts(s, [
      { type: "text", body: "hello" },
      { type: "image", src: "/img.jpg" },
    ]);
    accepts(s, []);
    rejects(s, [{ type: "video", src: "/vid.mp4" }]); // unknown type
    rejects(s, [{ body: "hello" }]); // missing type
  });

  it("list with variable types and custom typeKey", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      typeKey: "kind",
      types: [
        { name: "a", fields: [{ name: "val", widget: "string" }] },
        { name: "b", fields: [{ name: "num", widget: "number" }] },
      ],
    });
    accepts(s, [{ kind: "a", val: "x" }, { kind: "b", num: 9 }]);
    rejects(s, [{ type: "a", val: "x" }]); // wrong key
  });

  it("list with single variable type → z.array(z.object(...))", () => {
    const s = fieldToZod({
      name: "l",
      widget: "list",
      types: [{ name: "item", fields: [{ name: "x", widget: "string" }] }],
    });
    accepts(s, [{ type: "item", x: "value" }]);
    rejects(s, [{ type: "other", x: "value" }]);
  });

  it("list with empty types → z.array(z.any())", () => {
    const s = fieldToZod({ name: "l", widget: "list", types: [] });
    accepts(s, [1, "two", null, { any: "thing" }]);
  });

  it("deeply nested: list of objects containing lists", () => {
    const s = fieldToZod({
      name: "sections",
      widget: "list",
      fields: [
        { name: "title", widget: "string" },
        {
          name: "items",
          widget: "list",
          field: { name: "item", widget: "string" },
        },
      ],
    });
    accepts(s, [
      { title: "Section 1", items: ["a", "b"] },
      { title: "Section 2", items: [] },
    ]);
    rejects(s, [{ title: "S1", items: [1, 2] }]); // items not strings
    rejects(s, [{ title: "S1" }]); // items required (no required: false)
  });
});

describe("fieldToZod — unknown/custom widget", () => {
  it("returns z.any() for an unknown widget name", () => {
    const s = fieldToZod({ name: "x", widget: "my-custom-widget" } as unknown as Field);
    accepts(s, "string");
    accepts(s, 42);
    accepts(s, null);
    accepts(s, { complex: true });
  });

  it("returns z.any() for another unknown widget", () => {
    const s = fieldToZod({ name: "x", widget: "unknown-widget-xyz" } as unknown as Field);
    accepts(s, undefined);
  });
});
