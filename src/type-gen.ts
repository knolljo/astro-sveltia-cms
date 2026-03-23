import { z } from "astro/zod";
import type { EntryCollection } from "@sveltia/cms";
import type { TypeOverrideMap } from "zod-to-ts";
import { createAuxiliaryTypeStore, createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { frontmatterFormats, sveltiaSchema } from "./schema.js";
import type { SchemaContext } from "./schema.js";

type TypeOverrideFunction = TypeOverrideMap extends Map<unknown, infer V> ? V : never;

const imageOverride: TypeOverrideFunction = (typescript) =>
  typescript.factory.createTypeReferenceNode("ImageMetadata");

function relationOverride(collectionName: string): TypeOverrideFunction {
  return (typescript) =>
    typescript.factory.createTypeLiteralNode([
      typescript.factory.createPropertySignature(
        undefined,
        typescript.factory.createIdentifier("collection"),
        undefined,
        typescript.factory.createLiteralTypeNode(
          typescript.factory.createStringLiteral(collectionName),
        ),
      ),
      typescript.factory.createPropertySignature(
        undefined,
        typescript.factory.createIdentifier("id"),
        undefined,
        typescript.factory.createKeywordTypeNode(typescript.SyntaxKind.StringKeyword),
      ),
    ]);
}

export async function buildCollectionSchema(
  collection: EntryCollection,
): Promise<{ schema: z.ZodType; types: string }> {
  const ctx: SchemaContext = {
    imageSchemas: [],
    relationSchemas: new Map(),
  };
  const schema = sveltiaSchema(collection.fields, {
    excludeBody: frontmatterFormats.has(collection.format),
    ctx,
  });

  const overrides: TypeOverrideMap = new Map();
  for (const s of ctx.imageSchemas) {
    overrides.set(s, imageOverride);
  }
  for (const [s, collectionName] of ctx.relationSchemas) {
    overrides.set(s, relationOverride(collectionName));
  }

  const auxiliaryTypeStore = createAuxiliaryTypeStore();
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore,
    unrepresentable: "any",
    overrides,
  });
  const typeAlias = createTypeAlias(node, "Entry");
  const importLine =
    ctx.imageSchemas.length > 0 ? 'import type { ImageMetadata } from "astro";\n' : "";
  return { schema, types: `${importLine}export ${printNode(typeAlias)}` };
}
