import { describe, expect, test } from "bun:test";
import { checkConformance } from "@bixbd/utils-mcp-testkit";
import { desco } from "../src";
import { portalWith, run } from "./portal";

describe("desco tool catalog and passthrough tools", () => {
  test("conforms to the connector standard", () => {
    expect(checkConformance(desco)).toEqual([]);
  });

  test("all tools are read-only", () => {
    expect(desco.tools.every((t) => t.annotations.readOnlyHint && !t.annotations.destructiveHint)).toBe(true);
  });

  test("public tools pass data through", async () => {
    const result = await run("desco_get_tariff", {}, portalWith().fetch);
    expect(result).toEqual({ ok: true, data: { data: { title: "tariff", tariffStatus: "CURRENT" } } });
  });

  test("search tools build the query string and skip empty values", async () => {
    const result = await run("desco_find_recharge_points", { bank: "MYCash", area: "Mirpur", size: 5 }, portalWith().fetch);
    expect(result).toEqual({ ok: true, data: { data: { items: [{ posId: 1 }] } } });
  });

  test("signed-in tools resolve the account and mask meter numbers", async () => {
    const input = { dateFrom: "2026-11-01", dateTo: "2026-11-07" };
    const result = await run("desco_get_daily_usage", input, portalWith().fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.data)).toContain("9012");
      expect(JSON.stringify(result.data)).not.toContain("123456789012");
    }
  });

  test("rejects a malformed date", async () => {
    const result = await run("desco_get_daily_usage", { dateFrom: "01/11/2026" }, portalWith().fetch);
    expect(result.ok).toBe(false);
  });

  test("list_notices defaults to the active notices", async () => {
    const result = await run("desco_list_notices", {}, portalWith().fetch);
    expect(result).toEqual({ ok: true, data: { data: [{ id: 5, title: "notice" }] } });
  });
});
