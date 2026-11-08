import { createRegistry, envSecrets } from "@bixbd/utils-mcp-core";
import { fakePortal, type FakeHandler } from "@bixbd/utils-mcp-testkit";
import { desco } from "../src";

export type Options = {
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
export function portalWith(options: Options = {}) {
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
    "GET /public/notices/active": () => ({ body: [{ id: 5, title: "notice" }] }),
    "GET /public/tariff-schedules/current": () => ({ body: { title: "tariff", tariffStatus: "CURRENT" } }),
    "GET /public/pos-locations": () => ({ body: { items: [{ posId: 1 }] } }),
    "GET /accounts/123/usage/daily": guarded(() => ({
      items: [{ date: "2026-11-01", kwh: 3, meterNo: "123456789012" }],
    })),
    "GET /accounts": guarded(() => options.accounts ?? ONE_ACCOUNT),
    "GET /accounts/realtime-balance": guarded(() => options.realtime ?? { enabled: true, meters: [] }),
    "GET /accounts/123/balance": guarded(
      () => options.balance ?? { balance: 500.25, currency: "BDT", timestampAvailable: true, stale: false },
    ),
  });
}

export const credentials = { DESCO_USERNAME: "user", DESCO_PASSWORD: "pass" };

export const run = (tool: string, input: Record<string, unknown>, fetchImpl: typeof fetch, env: Record<string, string> = credentials) =>
  createRegistry([desco]).callTool(tool, input, {
    account: "default",
    fetch: fetchImpl,
    secrets: envSecrets("default", env),
  });
