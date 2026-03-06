import { describe, expect, it } from "vitest";
import sveltiaCms from "../src/index.ts";
import type { CmsConfig } from "@sveltia/cms";

const minimalConfig: CmsConfig = {
  backend: { name: "test-repo" },
  collections: [
    {
      name: "posts",
      folder: "src/content/posts",
      fields: [{ name: "title", widget: "string" }],
    },
  ],
};

describe("sveltiaCms — return shape", () => {
  it('returns an integration named "astro-sveltia-cms"', () => {
    const integration = sveltiaCms({ config: minimalConfig });
    expect(integration.name).toBe("astro-sveltia-cms");
  });

  it("returns an object with a hooks property", () => {
    const integration = sveltiaCms({ config: minimalConfig });
    expect(integration.hooks).toBeDefined();
    expect(typeof integration.hooks).toBe("object");
  });

  it('has the "astro:config:setup" hook', () => {
    const integration = sveltiaCms({ config: minimalConfig });
    expect(integration.hooks).toHaveProperty("astro:config:setup");
    expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
  });

  it('has the "astro:config:done" hook', () => {
    const integration = sveltiaCms({ config: minimalConfig });
    expect(integration.hooks).toHaveProperty("astro:config:done");
    expect(typeof integration.hooks["astro:config:done"]).toBe("function");
  });
});

describe("sveltiaCms — options handling", () => {
  it("accepts minimal options with only config", () => {
    expect(() => sveltiaCms({ config: minimalConfig })).not.toThrow();
  });

  it("accepts a custom route", () => {
    expect(() => sveltiaCms({ config: minimalConfig, route: "/cms" })).not.toThrow();
  });

  it("accepts a custom title", () => {
    expect(() => sveltiaCms({ config: minimalConfig, title: "My CMS" })).not.toThrow();
  });

  it("accepts all options together", () => {
    expect(() =>
      sveltiaCms({ config: minimalConfig, route: "/admin", title: "Admin" }),
    ).not.toThrow();
  });

  it("works with an empty collections array", () => {
    const config: CmsConfig = { backend: { name: "test-repo" }, collections: [] };
    expect(() => sveltiaCms({ config })).not.toThrow();
  });

  it("works with undefined collections", () => {
    const config: CmsConfig = { backend: { name: "test-repo" } };
    expect(() => sveltiaCms({ config })).not.toThrow();
  });
});

describe("sveltiaCms — astro:config:done type injection", () => {
  it("calls injectTypes with a union of collection names", () => {
    const integration = sveltiaCms({
      config: {
        backend: { name: "test-repo" },
        collections: [
          { name: "posts", folder: "src/content/posts", fields: [] },
          { name: "pages", folder: "src/content/pages", fields: [] },
        ],
      },
    });

    let injectedContent = "";
    const mockInjectTypes = (opts: { filename: string; content: string }) => {
      injectedContent = opts.content;
    };

    type DoneHook = (opts: { injectTypes: typeof mockInjectTypes }) => void;
    (integration.hooks["astro:config:done"] as unknown as DoneHook)({
      injectTypes: mockInjectTypes,
    });

    expect(injectedContent).toContain('"posts"');
    expect(injectedContent).toContain('"pages"');
  });

  it("does not call injectTypes when there are no entry collections", () => {
    const integration = sveltiaCms({
      config: {
        backend: { name: "test-repo" },
        collections: [],
      },
    });

    let injectTypesCalled = false;
    const mockInjectTypes = () => { injectTypesCalled = true; };
    type DoneHook = (opts: { injectTypes: typeof mockInjectTypes }) => void;

    (integration.hooks["astro:config:done"] as unknown as DoneHook)({
      injectTypes: mockInjectTypes,
    });

    expect(injectTypesCalled).toBe(false);
  });

  it("only includes folder+fields collections in the type union", () => {
    const integration = sveltiaCms({
      config: {
        backend: { name: "test-repo" },
        collections: [
          { name: "posts", folder: "src/content/posts", fields: [] }, // entry collection
          { name: "settings", files: [] }, // file collection — not included
        ],
      },
    });

    let injectedContent = "";
    const mockInjectTypes = (opts: { filename: string; content: string }) => {
      injectedContent = opts.content;
    };
    type DoneHook = (opts: { injectTypes: typeof mockInjectTypes }) => void;

    (integration.hooks["astro:config:done"] as unknown as DoneHook)({
      injectTypes: mockInjectTypes,
    });

    expect(injectedContent).toContain('"posts"');
    expect(injectedContent).not.toContain('"settings"');
  });
});
