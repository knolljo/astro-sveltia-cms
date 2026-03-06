import { describe, expect, it } from "vitest";
import { sveltiaSchema } from "../src/loader.ts";

describe("sveltiaSchema — body field exclusion", () => {
  it("excludes a markdown body field by default (excludeBody: true)", () => {
    const schema = sveltiaSchema([
      { name: "title", widget: "string" },
      { name: "body", widget: "markdown" },
    ]);
    const shape = schema.shape;
    expect(shape).toHaveProperty("title");
    expect(shape).not.toHaveProperty("body");
  });

  it("excludes a richtext body field by default", () => {
    const schema = sveltiaSchema([
      { name: "title", widget: "string" },
      { name: "body", widget: "richtext" },
    ]);
    expect(schema.shape).not.toHaveProperty("body");
  });

  it("includes body field when excludeBody: false", () => {
    const schema = sveltiaSchema(
      [
        { name: "title", widget: "string" },
        { name: "body", widget: "markdown" },
      ],
      { excludeBody: false },
    );
    expect(schema.shape).toHaveProperty("body");
    expect(schema.shape).toHaveProperty("title");
  });

  it("does NOT exclude a non-body markdown field (different name)", () => {
    const schema = sveltiaSchema([
      { name: "summary", widget: "markdown" },
      { name: "body", widget: "markdown" },
    ]);
    // summary has name !== "body" so it's kept; body is excluded
    expect(schema.shape).toHaveProperty("summary");
    expect(schema.shape).not.toHaveProperty("body");
  });

  it("does NOT exclude a body field with a non-markdown/richtext widget", () => {
    const schema = sveltiaSchema([{ name: "body", widget: "string" }]);
    expect(schema.shape).toHaveProperty("body");
  });

  it("excludes only the body, keeping all other fields", () => {
    const schema = sveltiaSchema([
      { name: "title", widget: "string" },
      { name: "date", widget: "datetime" },
      { name: "draft", widget: "boolean", required: false },
      { name: "body", widget: "markdown" },
    ]);
    const keys = Object.keys(schema.shape);
    expect(keys).toContain("title");
    expect(keys).toContain("date");
    expect(keys).toContain("draft");
    expect(keys).not.toContain("body");
  });
});

describe("sveltiaSchema — optional fields", () => {
  it("required: false → field is optional in parsed schema", () => {
    const schema = sveltiaSchema([
      { name: "title", widget: "string" },
      { name: "subtitle", widget: "string", required: false },
    ]);

    expect(schema.safeParse({ title: "Hello" }).success).toBe(true);
    expect(schema.safeParse({ title: "Hello", subtitle: "Sub" }).success).toBe(true);
    expect(schema.safeParse({ subtitle: "Sub" }).success).toBe(false);
  });

  it("required: true → field is required", () => {
    const schema = sveltiaSchema([{ name: "title", widget: "string", required: true }]);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ title: "Hello" }).success).toBe(true);
  });

  it("absent required → field is required", () => {
    const schema = sveltiaSchema([{ name: "title", widget: "string" }]);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ title: "Hi" }).success).toBe(true);
  });

  it("all optional fields → empty object is valid", () => {
    const schema = sveltiaSchema([
      { name: "a", widget: "string", required: false },
      { name: "b", widget: "number", required: false },
    ]);
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("sveltiaSchema — edge cases", () => {
  it("empty fields array → z.object({})", () => {
    const schema = sveltiaSchema([]);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("only body field → z.object({}) (body excluded)", () => {
    const schema = sveltiaSchema([{ name: "body", widget: "markdown" }]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(Object.keys(schema.shape)).toHaveLength(0);
  });
});

describe("sveltiaSchema — realistic blog post collection", () => {
  const fields = [
    { name: "title", widget: "string" },
    { name: "date", widget: "datetime" },
    { name: "draft", widget: "boolean", required: false },
    { name: "tags", widget: "list" },
    { name: "body", widget: "markdown" },
  ] as const;

  const schema = sveltiaSchema([...fields]);

  it("accepts a valid blog post entry", () => {
    const result = schema.safeParse({
      title: "My First Post",
      date: "2024-06-01T00:00:00Z",
      tags: ["intro", "meta"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a post with the optional draft field", () => {
    const result = schema.safeParse({
      title: "Draft Post",
      date: "2024-06-01",
      draft: true,
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when title is missing", () => {
    const result = schema.safeParse({
      date: "2024-06-01",
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when date is not parseable", () => {
    const result = schema.safeParse({
      title: "Post",
      date: "not-a-date",
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("does not include body in the schema shape", () => {
    expect(schema.shape).not.toHaveProperty("body");
  });
});

describe("sveltiaSchema — product catalog collection", () => {
  const schema = sveltiaSchema([
    { name: "name", widget: "string" },
    { name: "price", widget: "number" },
    { name: "category", widget: "select", options: ["electronics", "clothing", "books"] },
    { name: "image", widget: "image" },
    {
      name: "specs",
      widget: "object",
      fields: [
        { name: "weight", widget: "number", required: false },
        { name: "dimensions", widget: "string", required: false },
      ],
    },
    {
      name: "variants",
      widget: "list",
      fields: [
        { name: "sku", widget: "string" },
        { name: "color", widget: "string" },
      ],
    },
  ]);

  it("accepts a complete product entry", () => {
    const result = schema.safeParse({
      name: "Widget Pro",
      price: 49.99,
      category: "electronics",
      image: "/products/widget.jpg",
      specs: { weight: 0.5, dimensions: "10x5x2cm" },
      variants: [{ sku: "WP-BLK", color: "black" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a product with empty specs (all optional)", () => {
    const result = schema.safeParse({
      name: "Basic Widget",
      price: 9.99,
      category: "electronics",
      image: "/img.jpg",
      specs: {},
      variants: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid category", () => {
    const result = schema.safeParse({
      name: "Widget",
      price: 10,
      category: "invalid-category",
      image: "/img.jpg",
      specs: {},
      variants: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-number price", () => {
    const result = schema.safeParse({
      name: "Widget",
      price: "ten dollars",
      category: "electronics",
      image: "/img.jpg",
      specs: {},
      variants: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a variant missing sku", () => {
    const result = schema.safeParse({
      name: "Widget",
      price: 10,
      category: "electronics",
      image: "/img.jpg",
      specs: {},
      variants: [{ color: "blue" }], // missing sku
    });
    expect(result.success).toBe(false);
  });
});

describe("sveltiaSchema — page builder with variable types", () => {
  const schema = sveltiaSchema([
    { name: "title", widget: "string" },
    {
      name: "blocks",
      widget: "list",
      types: [
        {
          name: "hero",
          fields: [
            { name: "heading", widget: "string" },
            { name: "subheading", widget: "string", required: false },
          ],
        },
        {
          name: "text",
          fields: [{ name: "content", widget: "markdown" }],
        },
        {
          name: "gallery",
          fields: [{ name: "images", widget: "list", field: { name: "img", widget: "image" } }],
        },
      ],
    },
  ]);

  it("accepts a page with mixed blocks", () => {
    const result = schema.safeParse({
      title: "Home Page",
      blocks: [
        { type: "hero", heading: "Welcome" },
        { type: "text", content: "Some content here." },
        { type: "gallery", images: ["/a.jpg", "/b.jpg"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a hero block with optional subheading", () => {
    const result = schema.safeParse({
      title: "Page",
      blocks: [{ type: "hero", heading: "Hi", subheading: "Sub" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a block with an unknown type", () => {
    const result = schema.safeParse({
      title: "Page",
      blocks: [{ type: "video", url: "https://youtube.com/..." }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a hero block missing the required heading", () => {
    const result = schema.safeParse({
      title: "Page",
      blocks: [{ type: "hero" }], // missing heading
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty blocks list", () => {
    const result = schema.safeParse({ title: "Empty Page", blocks: [] });
    expect(result.success).toBe(true);
  });
});
