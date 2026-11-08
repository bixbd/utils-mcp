import { describe, expect, test } from "bun:test";
import { createRegistry } from "@bixbd/utils-mcp-core";
import { checkConformance, replayFetch } from "@bixbd/utils-mcp-testkit";
import status from "../fixtures/status.json";
import { example } from "../src";

const run = (fetchImpl: typeof fetch) =>
  createRegistry([example]).callTool("example_get_status", {}, { account: "default", fetch: fetchImpl });

describe("example connector", () => {
  test("conforms to the connector standard", () => {
    expect(checkConformance(example)).toEqual([]);
  });

  test("returns only the useful fields from the fixture", async () => {
    const result = await run(replayFetch([{ match: "/api/status", body: status }]));
    expect(result).toEqual({ ok: true, data: { state: "operational", updatedAt: "2026-11-08T00:00:00Z" } });
  });

  test("detects upstream format drift", async () => {
    const result = await run(replayFetch([{ match: "/api/status", body: { unexpected: true } }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_CHANGED");
  });

  test("maps HTTP errors to UPSTREAM_ERROR", async () => {
    const result = await run(replayFetch([{ match: "/api/status", status: 503, body: {} }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_ERROR");
  });
});
