import { describe, expect, test } from "bun:test";
import {
  apiKey,
  bearer,
  createHttp,
  envSecrets,
  formLogin,
  noAuth,
  UtilsError,
  z,
  type AuthStrategy,
  type RuntimeContext,
} from "@bixbd/utils-mcp-core";
import { fakePortal, type FakeHandler } from "../src";

const BASE = "https://portal.test/api";
const Pong = z.object({ pong: z.boolean() });

const runtimeFor = (
  fetchImpl: typeof fetch,
  secrets: Record<string, string | undefined> = {},
  account = "default",
): RuntimeContext => ({ account, fetch: fetchImpl, secrets: envSecrets(account, secrets) });

const httpFor = (auth: AuthStrategy, runtime: RuntimeContext) =>
  createHttp({ id: "acme", baseUrl: BASE, auth }, runtime);

const caught = async (promise: Promise<unknown>): Promise<UtilsError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof UtilsError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a UtilsError but nothing was thrown");
};

describe("createHttp basics", () => {
  test("returns validated JSON", async () => {
    const portal = fakePortal(BASE, { "GET /ping": () => ({ body: { pong: true, extra: 1 } }) });
    const result = await httpFor(noAuth(), runtimeFor(portal.fetch)).json("/ping", Pong);
    expect(result).toEqual({ pong: true });
  });

  test("reports where the shape changed but never the values", async () => {
    const portal = fakePortal(BASE, { "GET /ping": () => ({ body: { pong: "secret-value" } }) });
    const error = await caught(httpFor(noAuth(), runtimeFor(portal.fetch)).json("/ping", Pong));
    expect(error.code).toBe("UPSTREAM_CHANGED");
    expect(error.message).toContain("pong");
    expect(error.message).not.toContain("secret-value");
  });

  test("maps HTTP errors to UPSTREAM_ERROR", async () => {
    const portal = fakePortal(BASE, { "GET /ping": () => ({ status: 503 }) });
    const error = await caught(httpFor(noAuth(), runtimeFor(portal.fetch)).json("/ping", Pong));
    expect(error.code).toBe("UPSTREAM_ERROR");
  });

  test("maps a non-JSON body to UPSTREAM_CHANGED", async () => {
    const html = (async () => new Response("<html></html>", { status: 200 })) as unknown as typeof fetch;
    const error = await caught(httpFor(noAuth(), runtimeFor(html)).json("/ping", Pong));
    expect(error.code).toBe("UPSTREAM_CHANGED");
  });

  test("sends a JSON body for POST", async () => {
    let seen: unknown;
    const portal = fakePortal(BASE, {
      "POST /echo": (req) => {
        seen = req.body;
        return { body: { pong: true } };
      },
    });
    await httpFor(noAuth(), runtimeFor(portal.fetch)).json("/echo", Pong, { method: "POST", body: { a: 1 } });
    expect(seen).toEqual({ a: 1 });
  });
});

describe("apiKey and bearer", () => {
  test("apiKey sends the secret in the configured header", async () => {
    const portal = fakePortal(BASE, {
      "GET /ping": (req) => ({ body: { pong: req.headers.get("x-api-key") === "k1" } }),
    });
    const auth = apiKey({ header: "X-API-Key", secret: "ACME_API_KEY" });
    const result = await httpFor(auth, runtimeFor(portal.fetch, { ACME_API_KEY: "k1" })).json("/ping", Pong);
    expect(result.pong).toBe(true);
  });

  test("a missing secret names the env var, including the account suffix", async () => {
    const portal = fakePortal(BASE, {});
    const auth = apiKey({ header: "X-API-Key", secret: "ACME_API_KEY" });
    const error = await caught(httpFor(auth, runtimeFor(portal.fetch, {}, "office")).json("/ping", Pong));
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.hint).toContain("ACME_API_KEY__OFFICE");
    expect(portal.calls).toEqual([]);
  });

  test("bearer sends an Authorization header", async () => {
    const portal = fakePortal(BASE, {
      "GET /ping": (req) => ({ body: { pong: req.headers.get("authorization") === "Bearer t1" } }),
    });
    const result = await httpFor(bearer({ secret: "ACME_TOKEN" }), runtimeFor(portal.fetch, { ACME_TOKEN: "t1" })).json("/ping", Pong);
    expect(result.pong).toBe(true);
  });

  test("a 401 with a static key is not retried", async () => {
    const portal = fakePortal(BASE, { "GET /ping": () => ({ status: 401 }) });
    const auth = apiKey({ header: "X-API-Key", secret: "ACME_API_KEY" });
    const error = await caught(httpFor(auth, runtimeFor(portal.fetch, { ACME_API_KEY: "bad" })).json("/ping", Pong));
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(portal.count("GET /ping")).toBe(1);
  });
});

describe("formLogin", () => {
  const auth = formLogin({
    csrfPath: "/auth/csrf",
    loginPath: "/auth/login",
    secrets: { username: "ACME_USER", password: "ACME_PASS" },
  });
  const secrets = { ACME_USER: "user", ACME_PASS: "hunter2-secret" };

  /** Portal with CSRF cookie, a login that checks header and body, and cookie-protected data. */
  const portalWith = (options: { rejectLogin?: boolean; expireFirstData?: boolean; alwaysExpire?: boolean } = {}) => {
    let authed = false;
    let expireNext = options.expireFirstData ?? false;
    const protectedRoute: FakeHandler = (req) => {
      if (!authed || req.cookie("SESSION") !== "abc") {
        return { status: 401 };
      }
      if (options.alwaysExpire || expireNext) {
        expireNext = false;
        authed = false;
        return { status: 401 };
      }
      return { body: { pong: true } };
    };
    return fakePortal(BASE, {
      "GET /auth/csrf": () => ({ cookies: ["XSRF-TOKEN=tok%3D%3D; Path=/"] }),
      "POST /auth/login": (req) => {
        if (options.rejectLogin) {
          return { status: 401 };
        }
        const body = req.body as { username?: string; password?: string };
        if (req.headers.get("x-xsrf-token") !== "tok==" || body.username !== "user" || body.password !== "hunter2-secret") {
          return { status: 403 };
        }
        authed = true;
        return { cookies: ["SESSION=abc; Path=/; HttpOnly"] };
      },
      "GET /ping": protectedRoute,
      "POST /act": protectedRoute,
    });
  };

  test("fetches the CSRF cookie, logs in with the decoded token, then calls the API", async () => {
    const portal = portalWith();
    const result = await httpFor(auth, runtimeFor(portal.fetch, secrets)).json("/ping", Pong);
    expect(result.pong).toBe(true);
    expect(portal.calls).toEqual(["GET /auth/csrf", "POST /auth/login", "GET /ping"]);
  });

  test("reuses the session across calls", async () => {
    const portal = portalWith();
    const http = httpFor(auth, runtimeFor(portal.fetch, secrets));
    await http.json("/ping", Pong);
    await http.json("/ping", Pong);
    expect(portal.count("POST /auth/login")).toBe(1);
  });

  test("keeps separate sessions per account", async () => {
    const portal = portalWith();
    await httpFor(auth, runtimeFor(portal.fetch, secrets, "default")).json("/ping", Pong);
    await httpFor(auth, runtimeFor(portal.fetch, secrets, "default")).json("/ping", Pong);
    expect(portal.count("POST /auth/login")).toBe(1);
    const other = { ACME_USER__OFFICE: "user", ACME_PASS__OFFICE: "hunter2-secret" };
    await httpFor(auth, runtimeFor(portal.fetch, other, "office")).json("/ping", Pong);
    expect(portal.count("POST /auth/login")).toBe(2);
  });

  test("adds the CSRF header to non-GET requests only", async () => {
    let csrf: string | null = null;
    const portal = fakePortal(BASE, {
      "GET /auth/csrf": () => ({ cookies: ["XSRF-TOKEN=tok%3D%3D; Path=/"] }),
      "POST /auth/login": () => ({ cookies: ["SESSION=abc; Path=/"] }),
      "POST /act": (req) => {
        csrf = req.headers.get("x-xsrf-token");
        return { body: { pong: true } };
      },
    });
    await httpFor(auth, runtimeFor(portal.fetch, secrets)).json("/act", Pong, { method: "POST", body: {} });
    expect(csrf).toBe("tok==");
  });

  test("re-logs in exactly once when the session expires", async () => {
    const portal = portalWith({ expireFirstData: true });
    const result = await httpFor(auth, runtimeFor(portal.fetch, secrets)).json("/ping", Pong);
    expect(result.pong).toBe(true);
    expect(portal.count("POST /auth/login")).toBe(2);
  });

  test("gives up with AUTH_EXPIRED if the fresh session is rejected too", async () => {
    const portal = portalWith({ alwaysExpire: true });
    const error = await caught(httpFor(auth, runtimeFor(portal.fetch, secrets)).json("/ping", Pong));
    expect(error.code).toBe("AUTH_EXPIRED");
    expect(portal.count("POST /auth/login")).toBe(2);
  });

  test("never retries a rejected login and never echoes the password", async () => {
    const portal = portalWith({ rejectLogin: true });
    const error = await caught(httpFor(auth, runtimeFor(portal.fetch, secrets)).json("/ping", Pong));
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(JSON.stringify({ m: error.message, h: error.hint })).not.toContain("hunter2-secret");
    expect(portal.count("POST /auth/login")).toBe(1);
  });

  test("missing credentials fail before any request", async () => {
    const portal = portalWith();
    const error = await caught(httpFor(auth, runtimeFor(portal.fetch, {})).json("/ping", Pong));
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.hint).toContain("ACME_USER");
    expect(portal.calls).toEqual([]);
  });
});
