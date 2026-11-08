import { describe, expect, test } from "bun:test";
import { createRegistry, envSecrets } from "@bixbd/utils-mcp-core";
import { checkConformance, fakePortal, type FakeHandler } from "@bixbd/utils-mcp-testkit";
import { desco } from "../src";

type Options = {
  accounts?: unknown;
  balance?: unknown;
  realtime?: unknown;
  rejectLogin?: boolean;
  expireOnce?: boolean;
};

const ONE_ACCOUNT = {
  accounts: [{ accountId: 123, accountNo: "12345678", meterNo: "123456789012", status: "ACTIVE", linkStatus: "ACTIVE" }],
};

/** Fake DESCO portal: CSRF cookie, a login that checks the CSRF header, cookie-protected data. */
function portalWith(options: Options = {}) {
  let authed = false;
  let expireNext = options.expireOnce ?? false;
  const guarded = (data: () => unknown): FakeHandler => (req) => {
    if (!authed || req.cookie("SESSION") !== "abc") {
      return { status: 401, body: { errorCode: "AUTHENTICATION_REQUIRED" } };
    }
    if (expireNext) {
      expireNext = false;
      authed = false;
      return { status: 401, body: { errorCode: "AUTHENTICATION_REQUIRED" } };
    }
    return { body: data() };
  };
  return fakePortal("https://prepaid.desco.org.bd/api", {
    "GET /auth/csrf": () => ({ cookies: ["XSRF-TOKEN=tok%3D%3D; Path=/"] }),
    "POST /auth/login": (req) => {
      if (options.rejectLogin) {
        return { status: 401, body: { errorCode: "BAD_CREDENTIALS" } };
      }
      const body = req.body as { username: string; password: string };
      if (req.headers.get("x-xsrf-token") !== "tok==" || body.username !== "user" || body.password !== "pass") {
        return { status: 403 };
      }
      authed = true;
      return { cookies: ["SESSION=abc; Path=/; HttpOnly"] };
    },
    "GET /accounts": guarded(() => options.accounts ?? ONE_ACCOUNT),
    "GET /accounts/realtime-balance": guarded(() => options.realtime ?? { enabled: true, meters: [] }),
    "GET /accounts/123/balance": guarded(
      () => options.balance ?? { balance: 500.25, currency: "BDT", timestampAvailable: true, stale: false },
    ),
  });
}

const credentials = { DESCO_USERNAME: "user", DESCO_PASSWORD: "pass" };

const run = (tool: string, input: Record<string, unknown>, fetchImpl: typeof fetch, env: Record<string, string> = credentials) =>
  createRegistry([desco]).callTool(tool, input, {
    account: "default",
    fetch: fetchImpl,
    secrets: envSecrets("default", env),
  });

describe("desco connector", () => {
  test("conforms to the connector standard", () => {
    expect(checkConformance(desco)).toEqual([]);
  });

  test("all tools are read-only", () => {
    expect(desco.tools.every((t) => t.annotations.readOnlyHint && !t.annotations.destructiveHint)).toBe(true);
  });

  test("logs in with the decoded CSRF token and lists accounts with masked numbers", async () => {
    const portal = portalWith();
    const result = await run("desco_list_accounts", {}, portal.fetch);
    expect(result).toEqual({
      ok: true,
      data: {
        accounts: [
          { accountId: 123, accountNoLast4: "5678", meterNoLast4: "9012", status: "ACTIVE", linkStatus: "ACTIVE" },
        ],
      },
    });
    expect(portal.calls.slice(0, 2)).toEqual(["GET /auth/csrf", "POST /auth/login"]);
  });

  test("reuses the session for a second call", async () => {
    const portal = portalWith();
    await run("desco_list_accounts", {}, portal.fetch);
    await run("desco_list_accounts", {}, portal.fetch);
    expect(portal.count("POST /auth/login")).toBe(1);
  });

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

  test("missing credentials give a hint with the env var names and make no request", async () => {
    const portal = portalWith();
    const result = await run("desco_list_accounts", {}, portal.fetch, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
      expect(result.error.hint).toContain("DESCO_USERNAME");
    }
    expect(portal.calls).toEqual([]);
  });

  test("a rejected login is not retried and never echoes the password", async () => {
    const portal = portalWith({ rejectLogin: true });
    const result = await run("desco_list_accounts", {}, portal.fetch, {
      DESCO_USERNAME: "user",
      DESCO_PASSWORD: "hunter2-secret",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
      expect(JSON.stringify(result.error)).not.toContain("hunter2-secret");
    }
    expect(portal.count("POST /auth/login")).toBe(1);
  });

  test("an expired session triggers exactly one re-login", async () => {
    const portal = portalWith({ expireOnce: true });
    const result = await run("desco_list_accounts", {}, portal.fetch);
    expect(result.ok).toBe(true);
    expect(portal.count("POST /auth/login")).toBe(2);
  });

  test("detects upstream format drift", async () => {
    const result = await run("desco_list_accounts", {}, portalWith({ accounts: { items: [] } }).fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_CHANGED");
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
