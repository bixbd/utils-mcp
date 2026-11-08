import { z } from "zod/v4";

export { z };

export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/** Converts a zod object schema to the JSON Schema that MCP clients see. */
export function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = { ...z.toJSONSchema(schema, { io }) } as Record<string, unknown>;
  delete json.$schema;
  if (json.type !== "object") {
    throw new Error("Tool input and output schemas must be z.object(...)");
  }
  return json as JsonSchema;
}
