import { describe, expect, test } from "bun:test";
import { defineTool, maskLast4, toJsonSchema, z } from "../src";

describe("toJsonSchema", () => {
  test("produces an object schema without the $schema key", () => {
    const schema = toJsonSchema(z.object({ id: z.number().int().positive().optional() }), "input");
    expect(schema.type).toBe("object");
    expect("$schema" in schema).toBe(false);
    expect(Object.keys(schema.properties ?? {})).toEqual(["id"]);
  });

  test("rejects non-object schemas", () => {
    expect(() => toJsonSchema(z.string(), "input")).toThrow("z.object");
  });
});

describe("defineTool", () => {
  const ctx = { account: "default", fetch, secrets: { get: () => undefined }, http: { json: async () => ({}) as never } };
  const tool = defineTool({
    name: "double_number",
    description: "Doubles a number. Use when asked to double something.",
    access: "read",
    input: z.object({ n: z.number() }),
    output: z.object({ result: z.number() }),
    handler: async (input) => ({ result: input.n * 2 }),
  });

  test("validates input, runs the handler and returns parsed output", async () => {
    expect(await tool.run({ n: 4 }, ctx)).toEqual({ result: 8 });
  });

  test("rejects wrong input types with INVALID_INPUT", async () => {
    await expect(tool.run({ n: "4" }, ctx)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("maskLast4", () => {
  test("keeps the last four characters", () => {
    expect(maskLast4("123456789012")).toBe("9012");
  });

  test("returns null for short or missing values", () => {
    expect(maskLast4("123")).toBeNull();
    expect(maskLast4(undefined)).toBeNull();
    expect(maskLast4(null)).toBeNull();
  });
});
