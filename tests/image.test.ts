import { beforeEach, describe, expect, it, vi } from "vitest";
import { sveltiaLoader } from "../src/loader.ts";
import type { EntryCollection } from "@sveltia/cms";
import type { LoaderContext } from "astro/loaders";

// Capture the LoaderContext passed to the inner glob loader so tests can
// invoke parseData directly and inspect what reaches the original handler.
let capturedContext: LoaderContext;

vi.mock("astro/loaders", () => ({
  glob: vi.fn(() => ({
    load: vi.fn(async (ctx: LoaderContext) => {
      capturedContext = ctx;
    }),
  })),
}));

/**
 * Loads the collection's wrapped context, then runs `data` through the
 * wrapped parseData and returns what the original parseData received.
 */
async function transformData(
  collection: EntryCollection,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let received: Record<string, unknown> | undefined;
  const originalParseData = vi.fn(async (opts: { data: unknown }) => {
    received = opts.data as Record<string, unknown>;
  });
  await sveltiaLoader(collection).load({
    parseData: originalParseData,
  } as unknown as LoaderContext);
  await capturedContext.parseData({ id: "test", data } as never);
  return received!;
}

// ─── createSchema — TypeScript types output ────────────────────────────────

describe("createSchema — image field TypeScript types", () => {
  it("includes ImageMetadata import when collection has an image field", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [{ name: "cover", widget: "image" }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toContain('import type { ImageMetadata } from "astro"');
  });

  it("types image field as ImageMetadata", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [{ name: "cover", widget: "image" }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toMatch(/cover\s*:\s*ImageMetadata/);
  });

  it("optional image field is typed as ImageMetadata | undefined", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [{ name: "cover", widget: "image", required: false }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toMatch(/cover\?/);
    expect(types).toContain("ImageMetadata");
  });

  it("omits ImageMetadata import when collection has no image fields", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [{ name: "title", widget: "string" }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).not.toContain("ImageMetadata");
  });
});

// ─── prefixImageFields — path normalisation ───────────────────────────────

describe("image path normalisation", () => {
  const collection: EntryCollection = {
    name: "posts",
    folder: "src/content/posts",
    fields: [{ name: "cover", widget: "image" }],
  };

  it("prefixes a bare relative path and adds ./", async () => {
    const result = await transformData(collection, { cover: "assets/photo.jpg" });
    expect(result.cover).toBe("__ASTRO_IMAGE_./assets/photo.jpg");
  });

  it("keeps an already-relative path as-is (just adds prefix)", async () => {
    const result = await transformData(collection, { cover: "../../assets/photo.jpg" });
    expect(result.cover).toBe("__ASTRO_IMAGE_../../assets/photo.jpg");
  });

  it("passes through a URL unchanged (besides prefix)", async () => {
    const result = await transformData(collection, { cover: "https://example.com/img.png" });
    expect(result.cover).toBe("__ASTRO_IMAGE_https://example.com/img.png");
  });

  it("passes through an absolute path unchanged (besides prefix)", async () => {
    const result = await transformData(collection, { cover: "/static/photo.jpg" });
    expect(result.cover).toBe("__ASTRO_IMAGE_/static/photo.jpg");
  });

  it("passes through a Vite alias path unchanged (besides prefix)", async () => {
    const result = await transformData(collection, { cover: "@/assets/photo.jpg" });
    expect(result.cover).toBe("__ASTRO_IMAGE_@/assets/photo.jpg");
  });
});

// ─── prefixImageFields — null / missing values ────────────────────────────

describe("image field — null and missing values", () => {
  const collection: EntryCollection = {
    name: "posts",
    folder: "src/content/posts",
    fields: [{ name: "cover", widget: "image", required: false }],
  };

  it("leaves a null image value untouched", async () => {
    const result = await transformData(collection, { cover: null });
    expect(result.cover).toBeNull();
  });

  it("leaves an empty string image value untouched", async () => {
    const result = await transformData(collection, { cover: "" });
    expect(result.cover).toBe("");
  });

  it("leaves a missing image key untouched", async () => {
    const result = await transformData(collection, { title: "hello" });
    expect(result).not.toHaveProperty("cover");
  });
});

// ─── prefixImageFields — multiple (array) image field ────────────────────

describe("image field — multiple: true", () => {
  const collection: EntryCollection = {
    name: "posts",
    folder: "src/content/posts",
    fields: [{ name: "gallery", widget: "image", multiple: true } as never],
  };

  it("prefixes each item in a multiple image field", async () => {
    const result = await transformData(collection, { gallery: ["a.jpg", "b.png"] });
    expect(result.gallery).toEqual(["__ASTRO_IMAGE_./a.jpg", "__ASTRO_IMAGE_./b.png"]);
  });

  it("skips empty strings inside a multiple image array", async () => {
    const result = await transformData(collection, { gallery: ["a.jpg", ""] });
    expect(result.gallery).toEqual(["__ASTRO_IMAGE_./a.jpg", ""]);
  });
});

// ─── prefixImageFields — nested in object widget ──────────────────────────

describe("image field — nested in object widget", () => {
  it("prefixes image inside an object field with subFields", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        {
          name: "hero",
          widget: "object",
          fields: [
            { name: "src", widget: "image" },
            { name: "alt", widget: "string" },
          ],
        } as never,
      ],
    };
    const result = await transformData(collection, { hero: { src: "photo.jpg", alt: "A photo" } });
    const hero = result.hero as Record<string, unknown>;
    expect(hero.src).toBe("__ASTRO_IMAGE_./photo.jpg");
    expect(hero.alt).toBe("A photo");
  });

  it("prefixes image inside an object field with types (variants)", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        {
          name: "block",
          widget: "object",
          types: [
            { name: "image_block", fields: [{ name: "src", widget: "image" }] },
            { name: "text_block", fields: [{ name: "body", widget: "text" }] },
          ],
        } as never,
      ],
    };
    const result = await transformData(collection, {
      block: { type: "image_block", src: "photo.jpg" },
    });
    const block = result.block as Record<string, unknown>;
    expect(block.src).toBe("__ASTRO_IMAGE_./photo.jpg");
  });
});

// ─── prefixImageFields — nested in list widget ────────────────────────────

describe("image field — nested in list widget", () => {
  it("prefixes image when list uses a single image field", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        {
          name: "photos",
          widget: "list",
          field: { name: "photo", widget: "image" },
        } as never,
      ],
    };
    const result = await transformData(collection, { photos: ["a.jpg", "b.jpg"] });
    expect(result.photos).toEqual(["__ASTRO_IMAGE_./a.jpg", "__ASTRO_IMAGE_./b.jpg"]);
  });

  it("prefixes image inside list items that use subFields", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        {
          name: "gallery",
          widget: "list",
          fields: [
            { name: "src", widget: "image" },
            { name: "caption", widget: "string" },
          ],
        } as never,
      ],
    };
    const result = await transformData(collection, {
      gallery: [{ src: "a.jpg", caption: "First" }],
    });
    const item = (result.gallery as Record<string, unknown>[])[0]!;
    expect(item.src).toBe("__ASTRO_IMAGE_./a.jpg");
    expect(item.caption).toBe("First");
  });

  it("prefixes image inside list items that use types (variants)", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        {
          name: "blocks",
          widget: "list",
          types: [
            { name: "image_block", fields: [{ name: "src", widget: "image" }] },
            { name: "text_block", fields: [{ name: "body", widget: "text" }] },
          ],
        } as never,
      ],
    };
    const result = await transformData(collection, {
      blocks: [
        { type: "image_block", src: "photo.jpg" },
        { type: "text_block", body: "hello" },
      ],
    });
    const blocks = result.blocks as Record<string, unknown>[];
    expect(blocks[0]!.src).toBe("__ASTRO_IMAGE_./photo.jpg");
    expect(blocks[1]!.body).toBe("hello");
  });
});

// ─── prefixImageFields — body field exclusion ─────────────────────────────

describe("image field — body exclusion for frontmatter formats", () => {
  it("does not transform body markdown field in a frontmatter collection", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      // no format → defaults to yaml-frontmatter
      fields: [
        { name: "cover", widget: "image" },
        { name: "body", widget: "markdown" },
      ],
    };
    const result = await transformData(collection, { cover: "photo.jpg", body: "## Hello" });
    expect(result.cover).toBe("__ASTRO_IMAGE_./photo.jpg");
    expect(result.body).toBe("## Hello");
  });

  it("transforms body markdown field in a non-frontmatter collection (json)", async () => {
    const collection: EntryCollection = {
      name: "data",
      folder: "src/data",
      format: "json",
      fields: [
        { name: "cover", widget: "image" },
        { name: "body", widget: "markdown" },
      ],
    };
    // body is a markdown widget — it is only skipped in frontmatter format.
    // In json format it is included in the field loop but is not an image
    // widget, so it is left untouched regardless.
    const result = await transformData(collection, { cover: "photo.jpg", body: "## Hello" });
    expect(result.cover).toBe("__ASTRO_IMAGE_./photo.jpg");
    expect(result.body).toBe("## Hello");
  });
});

// ─── non-image fields ─────────────────────────────────────────────────────

describe("image prefix — non-image fields are not modified", () => {
  it("does not modify string, boolean, or number fields", async () => {
    const collection: EntryCollection = {
      name: "posts",
      folder: "src/content/posts",
      fields: [
        { name: "title", widget: "string" },
        { name: "draft", widget: "boolean" },
        { name: "views", widget: "number" },
        { name: "cover", widget: "image" },
      ],
    };
    const result = await transformData(collection, {
      title: "Hello",
      draft: false,
      views: 42,
      cover: "photo.jpg",
    });
    expect(result.title).toBe("Hello");
    expect(result.draft).toBe(false);
    expect(result.views).toBe(42);
    expect(result.cover).toBe("__ASTRO_IMAGE_./photo.jpg");
  });
});

// ─── createSchema — relation field TypeScript types ───────────────────────

describe("createSchema — relation field TypeScript types", () => {
  it("types a single relation field as { collection: '...'; id: string }", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "author", widget: "relation", collection: "members" }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toMatch(/author\s*:\s*\{/);
    expect(types).toContain('"members"');
    expect(types).toContain("string");
  });

  it("types an optional relation field with ?", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "related", widget: "relation", collection: "releases", required: false }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toMatch(/related\?/);
    expect(types).toContain('"releases"');
  });

  it("types a multiple relation field as an array", async () => {
    const collection: EntryCollection = {
      name: "tracks",
      folder: "src/content/tracks",
      fields: [{ name: "guests", widget: "relation", collection: "guests", multiple: true } as never],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).toMatch(/guests\s*:/);
    expect(types).toContain('"guests"');
    // array type: should contain [] somewhere after the field
    expect(types).toMatch(/\[\]/);
  });

  it("does not add ImageMetadata import for a relation-only collection", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "author", widget: "relation", collection: "members" }],
    };
    const { types } = await sveltiaLoader(collection).createSchema!();
    expect(types).not.toContain("ImageMetadata");
  });
});

// ─── relation field data transformation ───────────────────────────────────

describe("relation field — data transformation", () => {
  it("converts a single relation slug to { collection, id }", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "author", widget: "relation", collection: "members" }],
    };
    const result = await transformData(collection, { author: "jane-doe" });
    expect(result.author).toEqual({ collection: "members", id: "jane-doe" });
  });

  it("converts a multiple relation to an array of { collection, id } objects", async () => {
    const collection: EntryCollection = {
      name: "tracks",
      folder: "src/content/tracks",
      fields: [{ name: "guests", widget: "relation", collection: "guests", multiple: true } as never],
    };
    const result = await transformData(collection, { guests: ["alice", "bob"] });
    expect(result.guests).toEqual([
      { collection: "guests", id: "alice" },
      { collection: "guests", id: "bob" },
    ]);
  });

  it("leaves null/missing relation values untouched", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "author", widget: "relation", collection: "members", required: false }],
    };
    const result = await transformData(collection, { title: "No author" });
    expect(result).not.toHaveProperty("author");
  });

  it("leaves an already-transformed { collection, id } object untouched", async () => {
    const collection: EntryCollection = {
      name: "articles",
      folder: "src/content/articles",
      fields: [{ name: "author", widget: "relation", collection: "members" }],
    };
    const alreadyTransformed = { collection: "members", id: "jane-doe" };
    const result = await transformData(collection, { author: alreadyTransformed });
    // Non-string values pass through unchanged
    expect(result.author).toEqual(alreadyTransformed);
  });
});
