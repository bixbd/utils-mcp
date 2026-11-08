import { describe, expect, test } from "bun:test";
import { createRegistry, defineConnector, defineTool, noAuth, UtilsError, z } from "../src";

const demo = defineConnector({
  id: "demo",
  version: "0.1.0",
  status: "active",
  description: "Demo connector",
  baseUrl: "https://demo.test/",
  auth: noAuth(),
  tools: [
    defineTool({
      name: "echo_text",
      description: "Echo text back. Use to test the connector pipeline.",
      access: "read",
      input: z.object({ text: z.string() }),
      output: z.object({ text: z.string() }),
      handler: async (input) => ({ text: input.text }),
    }),
    defineTool({
      name: "fail_auth",
      description: "Always fails with an expired session. Use in tests only.",
      access: "read",
      input: z.object({}),
      output: z.object({}),
      handler: async () => {
        throw new UtilsError("AUTH_EXPIRED", "Session expired", "Run `utils-mcp login demo`.");
      },
    }),
    defineTool({
      name: "bad_output",
      description: "Returns data that breaks its own output schema. Use in tests only.",
      access: "read",
      input: z.object({}),
      output: z.object({ count: z.number() }),
      handler: async () => ({ count: "nope" }) as unknown as { count: number },
    }),
  ],
});

const runtime = { account: "default", fetch, secrets: { get: () => undefined } };

describe("registry", () => {
  test("prefixes tool names with the connector id and trims the base URL", () => {
    const names = createRegistry([demo]).listTools().map((t) => t.name);
    expect(names).toEqual(["demo_echo_text", "demo_fail_auth", "demo_bad_output"]);
    expect(demo.baseUrl).toBe("https://demo.test");
  });

  test("only enabled connectors expose tools", () => {
    expect(createRegistry([demo], []).listTools()).toHaveLength(0);
  });

  test("broken connectors are skipped", () => {
    expect(createRegistry([{ ...demo, status: "broken" }]).listTools()).toHaveLength(0);
  });

  test("exposes JSON schemas and annotations generated from the tool definition", () => {
    const tool = createRegistry([demo]).listTools()[0];
    expect(tool?.inputSchema.type).toBe("object");
    expect(tool?.inputSchema.required).toEqual(["text"]);
    expect(tool?.outputSchema.type).toBe("object");
    expect(tool?.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
  });

  test("calls a tool and returns validated data", async () => {
    const result = await createRegistry([demo]).callTool("demo_echo_text", { text: "hi" }, runtime);
    expect(result).toEqual({ ok: true, data: { text: "hi" } });
  });

  test("rejects invalid input and names the field", async () => {
    const result = await createRegistry([demo]).callTool("demo_echo_text", {}, runtime);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.message).toContain("text");
    }
  });

  test("maps connector errors to a guiding payload", async () => {
    const result = await createRegistry([demo]).callTool("demo_fail_auth", {}, runtime);
    expect(result).toEqual({
      ok: false,
      error: { code: "AUTH_EXPIRED", message: "Session expired", hint: "Run `utils-mcp login demo`." },
    });
  });

  test("a handler that breaks its output schema is reported as an internal error", async () => {
    const result = await createRegistry([demo]).callTool("demo_bad_output", {}, runtime);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toContain("output schema");
    }
  });

  test("unknown tool returns UNKNOWN_TOOL", async () => {
    const result = await createRegistry([demo]).callTool("nope", {}, runtime);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_TOOL");
    }
  });

  test("access levels map to annotations", () => {
    const write = defineTool({
      name: "update_thing",
      description: "Changes a thing. Use when asked to update it.",
      access: "write",
      input: z.object({}),
      output: z.object({}),
      handler: async () => ({}),
    });
    const destructive = defineTool({
      name: "delete_thing",
      description: "Deletes a thing. Irreversible.",
      access: "destructive",
      input: z.object({}),
      output: z.object({}),
      handler: async () => ({}),
    });
    expect(write.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    expect(destructive.annotations.destructiveHint).toBe(true);
  });
});
