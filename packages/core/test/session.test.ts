import { describe, expect, test } from "bun:test";
import { createSessionFetch, envSecrets, secretEnvName } from "../src";

describe("secrets", () => {
  test("default account uses the plain env name", () => {
    expect(secretEnvName("DESCO_USERNAME", "default")).toBe("DESCO_USERNAME");
  });

  test("named accounts add a normalized suffix", () => {
    expect(secretEnvName("DESCO_USERNAME", "my office")).toBe("DESCO_USERNAME__MY_OFFICE");
  });

  test("reads from env, treats empty as missing, never falls back to default", () => {
    const env = { DESCO_USERNAME: "default-user", DESCO_PASSWORD__OFFICE: "", DESCO_USERNAME__OFFICE: "office-user" };
    expect(envSecrets("default", env).get("DESCO_USERNAME")).toBe("default-user");
    expect(envSecrets("office", env).get("DESCO_USERNAME")).toBe("office-user");
    expect(envSecrets("office", env).get("DESCO_PASSWORD")).toBeUndefined();
    expect(envSecrets("home", env).get("DESCO_USERNAME")).toBeUndefined();
  });
});

describe("createSessionFetch", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const fake = () => {
    const seen: string[] = [];
    const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("cookie") ?? "");
      const headers = new Headers();
      if (String(input).endsWith("/set")) {
        headers.append("set-cookie", "A=1; Path=/; HttpOnly");
        headers.append("set-cookie", "B=two%3D; Path=/");
      }
      if (String(input).endsWith("/drop")) {
        headers.append("set-cookie", "A=; Max-Age=0; Path=/");
      }
      return new Response("{}", { headers });
    };
    return { fetch: fn as unknown as typeof fetch, seen };
  };

  test("stores cookies and sends them on later requests", async () => {
    const { fetch: base, seen } = fake();
    const session = createSessionFetch(base);
    await session.fetch("https://portal.test/set");
    await session.fetch("https://portal.test/next");
    expect(seen).toEqual(["", "A=1; B=two%3D"]);
    expect(session.cookie("B")).toBe("two%3D");
  });

  test("does not send cookies to another host", async () => {
    const { fetch: base, seen } = fake();
    const session = createSessionFetch(base);
    await session.fetch("https://portal.test/set");
    await session.fetch("https://other.test/next");
    expect(seen[1]).toBe("");
  });

  test("Max-Age=0 deletes and clear() empties the jar", async () => {
    const { fetch: base } = fake();
    const session = createSessionFetch(base);
    await session.fetch("https://portal.test/set");
    await session.fetch("https://portal.test/drop");
    expect(session.cookie("A")).toBeUndefined();
    expect(session.cookie("B")).toBe("two%3D");
    session.clear();
    expect(session.cookie("B")).toBeUndefined();
  });
});
