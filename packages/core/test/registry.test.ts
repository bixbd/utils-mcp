import { describe, expect, test } from "bun:test";
import { createRegistry, UtilsError, type Connector } from "../src";

const demo: Connector = {
  id: "demo",
  version: "0.1.0",
  status: "active",
  description: "Demo connector",
  auth: ["none"],
  tools: [
    {
      name: "echo_text",
      description: "Echo text back. Use to test the connector pipeline.",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      annotations: { readOnlyHint: true, destructiveHint: false },
      handler: async (input) => ({ text: input.text }),
    },
    {
      name: "fail_auth",
      description: "Always fails with an expired session.",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true, destructiveHint: false },
      handler: async () => {
        throw new UtilsError("AUTH_EXPIRED", "Session expired", "Run `utils-mcp login demo`.");
      },
    },
  ],
};

const ctx = { account: "default", fetch };

describe("registry", () => {
  test("prefixes tool names with the connector id", () => {
    const names = createRegistry([demo]).listTools().map((t) => t.name);
    expect(names).toEqual(["demo_echo_text", "demo_fail_auth"]);
  });

  test("only enabled connectors expose tools", () => {
    expect(createRegistry([demo], []).listTools()).toHaveLength(0);
  });

  test("broken connectors are skipped", () => {
    expect(createRegistry([{ ...demo, status: "broken" }]).listTools()).toHaveLength(0);
  });

  test("calls a tool and returns data", async () => {
    const result = await createRegistry([demo]).callTool("demo_echo_text", { text: "hi" }, ctx);
    expect(result).toEqual({ ok: true, data: { text: "hi" } });
  });

  test("rejects missing required input with a hint", async () => {
    const result = await createRegistry([demo]).callTool("demo_echo_text", {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.hint).toContain("text");
    }
  });

  test("maps connector errors to a guiding payload", async () => {
    const result = await createRegistry([demo]).callTool("demo_fail_auth", {}, ctx);
    expect(result).toEqual({
      ok: false,
      error: { code: "AUTH_EXPIRED", message: "Session expired", hint: "Run `utils-mcp login demo`." },
    });
  });

  test("unknown tool returns UNKNOWN_TOOL", async () => {
    const result = await createRegistry([demo]).callTool("nope", {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_TOOL");
    }
  });
});
