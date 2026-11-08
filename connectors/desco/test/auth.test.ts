import { describe, expect, test } from "bun:test";
import { portalWith, run } from "./portal";

describe("desco sign-in and session", () => {
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
});
