import { describe, expect, test } from "bun:test";
import { createHttp, htmlFormLogin, envSecrets, UtilsError, type AuthStrategy, type RuntimeContext } from "@bixbd/utils-mcp-core";
import { fakePortal } from "../src";

const BASE = "https://portal.test";
const tokenField = "_token";

const runtimeFor = (
  fetchImpl: typeof fetch,
  secrets: Record<string, string | undefined> = {},
  account = "default",
): RuntimeContext => ({ account, fetch: fetchImpl, secrets: envSecrets(account, secrets) });

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

const loginPage = (valueFirst: boolean, withSignature = true) => {
  const signature = `<input name="csSignature" value="sig1">`;
  const signatureReversed = `<input value="sig1" name="csSignature">`;
  let signatureMarkup = "";
  if (withSignature && valueFirst) {
    signatureMarkup = signatureReversed;
  } else if (withSignature) {
    signatureMarkup = signature;
  }
  return `
    <form method="post" action="/login">
      ${signatureMarkup}
      <input name="${tokenField}" value="csrfTok">
      <input name="email_or_mobile">
      <input name="password">
    </form>
  `;
};

describe("htmlFormLogin", () => {
  const auth: AuthStrategy = htmlFormLogin({
    pagePath: "/login",
    loginPath: "/login",
    secrets: { username: "RP_EMAIL", password: "RP_PASS" },
    fields: { username: "email_or_mobile", password: "password" },
    hiddenFields: [tokenField, "csSignature"],
  });
  const creds = { RP_EMAIL: "user@example.com", RP_PASS: "hunter2-secret" };

  const portalWith = (options: { reject?: number; loginPage?: string } = {}) =>
    fakePortal(BASE, {
      "GET /login": () => ({ body: options.loginPage ?? loginPage(false) }),
      "POST /login": (req) => {
        if (options.reject) {
          return { status: options.reject };
        }
        const body = (req.body ?? {}) as Record<string, string>;
        if (body[tokenField] !== "csrfTok" || body.csSignature !== "sig1" || body.email_or_mobile !== "user@example.com" || body.password !== "hunter2-secret") {
          return { status: 403 };
        }
        return { cookies: ["SESSION=abc; Path=/; HttpOnly"] };
      },
      "GET /ping": () => ({ body: "<html>ok</html>" }),
    });

  test("replays hidden inputs with the credentials, both attribute orders", async () => {
    const outcomes = await Promise.all([loginPage(false), loginPage(true)].map(async (page) => {
      const portal = portalWith({ loginPage: page });
      const result = await createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, creds)).text("/ping");
      return { portal, result };
    }));
    for (const outcome of outcomes) {
      expect(outcome.result).toContain("ok");
      expect(outcome.portal.calls).toEqual(["GET /login", "POST /login", "GET /ping"]);
    }
  });

  test("reuses the session across calls", async () => {
    const portal = portalWith();
    const http = createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, creds));
    await http.text("/ping");
    await http.text("/ping");
    expect(portal.count("POST /login")).toBe(1);
  });

  test("a missing hidden input is UPSTREAM_CHANGED", async () => {
    const portal = portalWith({ loginPage: loginPage(false, false) });
    const error = await caught(createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, creds)).text("/ping"));
    expect(error.code).toBe("UPSTREAM_CHANGED");
    expect(error.message).toContain("csSignature");
  });

  test("rejected logins surface as AUTH_REQUIRED", async () => {
    const portal = portalWith({ reject: 401 });
    const error = await caught(createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, creds)).text("/ping"));
    expect(error.code).toBe("AUTH_REQUIRED");
  });

  test("server problems surface as UPSTREAM_ERROR", async () => {
    const portal = portalWith({ reject: 500 });
    const error = await caught(createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, creds)).text("/ping"));
    expect(error.code).toBe("UPSTREAM_ERROR");
  });

  test("missing credentials fail before any request", async () => {
    const portal = fakePortal(BASE, {});
    const error = await caught(createHttp({ id: "x", baseUrl: BASE, auth }, runtimeFor(portal.fetch, {})).text("/login"));
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(portal.calls).toEqual([]);
  });
});
