import { describe, expect, test } from "bun:test";
import { defineConnector, defineTool, noAuth, z } from "@bixbd/utils-mcp-core";
import { checkConformance, fakePortal, replayFetch } from "../src";

const tool = defineTool({
  name: "get_status",
  description: "Get the current status. Use when asked about uptime.",
  access: "read",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  handler: async () => ({ ok: true }),
});

const good = defineConnector({
  id: "good-one",
  version: "1.0.0",
  status: "active",
  description: "A well-formed connector",
  baseUrl: "https://good.test",
  auth: noAuth(),
  tools: [tool],
});

describe("checkConformance", () => {
  test("accepts a well-formed connector", () => {
    expect(checkConformance(good)).toEqual([]);
  });

  test("flags bad ids, names, short descriptions and non-https URLs", () => {
    const bad = {
      ...good,
      id: "Bad_ID",
      baseUrl: "http://insecure.test",
      tools: [{ ...tool, name: "status", description: "short" }],
    };
    const problems = checkConformance(bad);
    expect(problems.some((p) => p.includes("kebab-case"))).toBe(true);
    expect(problems.some((p) => p.includes("https"))).toBe(true);
    expect(problems.some((p) => p.includes("verb_noun"))).toBe(true);
    expect(problems.some((p) => p.includes("description"))).toBe(true);
  });

  test("flags a tool that is both read-only and destructive", () => {
    const broken = { ...tool, annotations: { readOnlyHint: true, destructiveHint: true, idempotentHint: true } };
    expect(checkConformance({ ...good, tools: [broken] }).some((p) => p.includes("destructive"))).toBe(true);
  });

  test("flags duplicate tool names and empty tool lists", () => {
    expect(checkConformance({ ...good, tools: [tool, tool] }).some((p) => p.includes("duplicate"))).toBe(true);
    expect(checkConformance({ ...good, tools: [] }).some((p) => p.includes("no tools"))).toBe(true);
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

describe("fakePortal", () => {
  test("routes by method and path, exposes cookies, records calls", async () => {
    const portal = fakePortal("https://portal.test/api/", {
      "GET /ping": (req) => ({ body: { who: req.cookie("SESSION") ?? null }, cookies: ["A=1; Path=/"] }),
    });
    const res = await portal.fetch("https://portal.test/api/ping?x=1", { headers: { cookie: "SESSION=s1; B=2" } });
    expect(await res.json()).toEqual({ who: "s1" });
    expect(res.headers.getSetCookie()).toEqual(["A=1; Path=/"]);
    expect(portal.calls).toEqual(["GET /ping"]);
    expect(portal.count("GET /ping")).toBe(1);
  });

  test("throws for an unrouted request", async () => {
    const portal = fakePortal("https://portal.test", {});
    await expect(portal.fetch("https://portal.test/missing")).rejects.toThrow("no route");
  });
});
