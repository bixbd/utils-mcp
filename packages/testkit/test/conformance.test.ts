import { describe, expect, test } from "bun:test";
import type { Connector } from "@bixbd/utils-mcp-core";
import { checkConformance, replayFetch } from "../src";

const good: Connector = {
  id: "good-one",
  version: "1.0.0",
  status: "active",
  description: "A well-formed connector",
  auth: ["none"],
  tools: [
    {
      name: "get_status",
      description: "Get the current status. Use when asked about uptime.",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true, destructiveHint: false },
      handler: async () => ({}),
    },
  ],
};

describe("checkConformance", () => {
  test("accepts a well-formed connector", () => {
    expect(checkConformance(good)).toEqual([]);
  });

  test("flags bad ids, names and short descriptions", () => {
    const bad = {
      ...good,
      id: "Bad_ID",
      tools: [{ ...good.tools[0]!, name: "status", description: "short" }],
    };
    const problems = checkConformance(bad);
    expect(problems.some((p) => p.includes("kebab-case"))).toBe(true);
    expect(problems.some((p) => p.includes("verb_noun"))).toBe(true);
    expect(problems.some((p) => p.includes("description"))).toBe(true);
  });

  test("flags a write tool without destructiveHint", () => {
    const tool = { ...good.tools[0]!, annotations: { readOnlyHint: false } as never };
    expect(checkConformance({ ...good, tools: [tool] }).some((p) => p.includes("destructiveHint"))).toBe(true);
  });
});

describe("replayFetch", () => {
  test("serves a matching fixture", async () => {
    const f = replayFetch([{ match: "/api/ping", body: { ok: true } }]);
    const res = await f("https://portal.test/api/ping");
    expect(await res.json()).toEqual({ ok: true });
  });

  test("throws when nothing matches", async () => {
    const f = replayFetch([]);
    await expect(f("https://portal.test/x")).rejects.toThrow("no fixture");
  });
});
