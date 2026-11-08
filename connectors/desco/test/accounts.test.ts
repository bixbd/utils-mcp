import { describe, expect, test } from "bun:test";
import { portalWith, run } from "./portal";

describe("desco accounts and balance", () => {
  test("get_balance resolves the only linked account by itself", async () => {
    const result = await run("desco_get_balance", {}, portalWith().fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ balance: 500.25, currency: "BDT", stale: false });
    }
  });

  test("get_balance asks for accountId when several accounts are linked", async () => {
    const accounts = {
      accounts: [
        { accountId: 123, meterNo: "123456789012" },
        { accountId: 456, meterNo: "999999990000" },
      ],
    };
    const result = await run("desco_get_balance", {}, portalWith({ accounts }).fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.hint).toContain("456");
      expect(result.error.hint).not.toContain("999999990000");
    }
  });

  test("reports no linked accounts clearly", async () => {
    const result = await run("desco_get_balance", {}, portalWith({ accounts: { accounts: [] } }).fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("an unavailable balance is flagged, never reported as zero", async () => {
    const balance = { balance: null, currency: "BDT", timestampAvailable: false };
    const result = await run("desco_get_balance", { accountId: 123 }, portalWith({ balance }).fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { balance: number | null; note: string };
      expect(data.balance).toBeNull();
      expect(data.note).toContain("Do not treat it as zero");
    }
  });

  test("rejects a non-positive accountId", async () => {
    const result = await run("desco_get_balance", { accountId: 0 }, portalWith().fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  test("get_realtime_status maps meters and masks the meter number", async () => {
    const realtime = {
      enabled: true,
      meters: [
        { accountId: 123, meterNo: "123456789012", status: "DAILY_LIMIT_REACHED", remainingAttempts: 2, attemptsToday: 3 },
      ],
    };
    const result = await run("desco_get_realtime_status", {}, portalWith({ realtime }).fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        enabled: true,
        meters: [{ accountId: 123, meterNoLast4: "9012", status: "DAILY_LIMIT_REACHED", remainingAttempts: 2 }],
      });
    }
  });
});
