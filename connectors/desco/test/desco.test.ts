import { describe, expect, test } from "bun:test";
import { createRegistry, type ToolContext } from "@bixbd/utils-mcp-core";
import { checkConformance } from "@bixbd/utils-mcp-testkit";
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

/** Fake DESCO portal: CSRF cookie, login that checks the CSRF header, cookie-protected data. */
function fakeDesco(options: Options = {}) {
  const calls: string[] = [];
  let authed = false;
  let expireNext = options.expireOnce ?? false;
  let logins = 0;

  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push(`${init?.method ?? "GET"} ${url.replace("https://prepaid.desco.org.bd/api", "")}`);
    const json = (body: unknown, status = 200, cookies: string[] = []) => {
      const h = new Headers({ "content-type": "application/json" });
      for (const cookie of cookies) {
        h.append("set-cookie", cookie);
      }
      return new Response(JSON.stringify(body), { status, headers: h });
    };

    if (url.endsWith("/auth/csrf")) {
      return json({}, 200, ["XSRF-TOKEN=tok%3D%3D; Path=/"]);
    }
    if (url.endsWith("/auth/login")) {
      logins += 1;
      if (options.rejectLogin) {
        return json({ errorCode: "BAD_CREDENTIALS" }, 401);
      }
      const body = JSON.parse(String(init?.body)) as { username: string; password: string };
      if (headers.get("x-xsrf-token") !== "tok==" || body.username !== "user" || body.password !== "pass") {
        return json({ errorCode: "FORBIDDEN" }, 403);
      }
      authed = true;
      return json({}, 200, ["SESSION=abc; Path=/; HttpOnly"]);
    }
    if (!authed || !(headers.get("cookie") ?? "").includes("SESSION=abc")) {
      return json({ errorCode: "AUTHENTICATION_REQUIRED" }, 401);
    }
    if (expireNext) {
      expireNext = false;
      authed = false;
      return json({ errorCode: "AUTHENTICATION_REQUIRED" }, 401);
    }
    if (url.endsWith("/accounts")) {
      return json(options.accounts ?? ONE_ACCOUNT);
    }
    if (url.endsWith("/accounts/realtime-balance")) {
      return json(options.realtime ?? { enabled: true, meters: [] });
    }
    if (url.endsWith("/accounts/123/balance")) {
      return json(options.balance ?? { balance: 500.25, currency: "BDT", timestampAvailable: true, stale: false });
    }
    return json({}, 404);
  };

  return {
    fetch: fn as unknown as typeof fetch,
    calls,
    logins: () => logins,
  };
}

const credentials: Record<string, string | undefined> = { DESCO_USERNAME: "user", DESCO_PASSWORD: "pass" };

const run = (tool: string, input: Record<string, unknown>, fetchImpl: typeof fetch, secrets = credentials) => {
  const ctx: ToolContext = { account: "default", fetch: fetchImpl, secrets: { get: (name) => secrets[name] } };
  return createRegistry([desco]).callTool(tool, input, ctx);
};

describe("desco connector", () => {
  test("conforms to the connector standard", () => {
    expect(checkConformance(desco)).toEqual([]);
  });

  test("logs in with the decoded CSRF token and lists accounts with masked numbers", async () => {
    const portal = fakeDesco();
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
    const portal = fakeDesco();
    await run("desco_list_accounts", {}, portal.fetch);
    await run("desco_list_accounts", {}, portal.fetch);
    expect(portal.logins()).toBe(1);
  });

  test("get_balance resolves the only linked account by itself", async () => {
    const result = await run("desco_get_balance", {}, fakeDesco().fetch);
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
    const result = await run("desco_get_balance", {}, fakeDesco({ accounts }).fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.hint).toContain("456");
      expect(result.error.hint).not.toContain("999999990000");
    }
  });

  test("an unavailable balance is flagged, never reported as zero", async () => {
    const balance = { balance: null, currency: "BDT", timestampAvailable: false };
    const result = await run("desco_get_balance", { accountId: 123 }, fakeDesco({ balance }).fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { balance: number | null; note: string };
      expect(data.balance).toBeNull();
      expect(data.note).toContain("Do not treat it as zero");
    }
  });

  test("missing credentials give a hint with the env var names and make no request", async () => {
    const portal = fakeDesco();
    const result = await run("desco_list_accounts", {}, portal.fetch, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
      expect(result.error.hint).toContain("DESCO_USERNAME");
      expect(result.error.hint).toContain("DESCO_PASSWORD");
    }
    expect(portal.calls).toEqual([]);
  });

  test("a rejected login is not retried and never echoes the password", async () => {
    const portal = fakeDesco({ rejectLogin: true });
    const result = await run("desco_list_accounts", {}, portal.fetch, {
      DESCO_USERNAME: "user",
      DESCO_PASSWORD: "hunter2-secret",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
      expect(JSON.stringify(result.error)).not.toContain("hunter2-secret");
    }
    expect(portal.logins()).toBe(1);
  });

  test("an expired session triggers exactly one re-login", async () => {
    const portal = fakeDesco({ expireOnce: true });
    const result = await run("desco_list_accounts", {}, portal.fetch);
    expect(result.ok).toBe(true);
    expect(portal.logins()).toBe(2);
  });

  test("detects upstream format drift", async () => {
    const result = await run("desco_list_accounts", {}, fakeDesco({ accounts: { items: [] } }).fetch);
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
    const result = await run("desco_get_realtime_status", {}, fakeDesco({ realtime }).fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        enabled: true,
        meters: [{ accountId: 123, meterNoLast4: "9012", status: "DAILY_LIMIT_REACHED", remainingAttempts: 2 }],
      });
    }
  });
});
