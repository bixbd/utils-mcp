import { urlOf } from "@bixbd/utils-mcp-core";

export type FakeRequest = {
  method: string;
  /** Path after the base URL, including the query string. */
  path: string;
  headers: Headers;
  /** Parsed JSON body, or undefined when there is none. */
  body: unknown;
  /** Reads a cookie the client sent. */
  cookie(name: string): string | undefined;
};

export type FakeReply = {
  status?: number;
  body?: unknown;
  /** Raw Set-Cookie header values. */
  cookies?: string[];
};

export type FakeHandler = (request: FakeRequest) => FakeReply | Promise<FakeReply>;

export type FakePortal = {
  fetch: typeof fetch;
  /** Every request seen, as "METHOD /path". */
  calls: string[];
  count(call: string): number;
};

/**
 * Offline stand-in for a portal. Routes are keyed "METHOD /path".
 * Keep state (logged in, expiry) in your own closure to test session flows.
 * A request with no matching route throws, so tests fail loudly.
 */
export function fakePortal(baseUrl: string, routes: Record<string, FakeHandler>): FakePortal {
  const base = baseUrl.replace(/\/+$/, "");
  const calls: string[] = [];

  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    if (!url.startsWith(base)) {
      throw new Error(`fakePortal: ${url} is outside ${base}`);
    }
    const path = url.slice(base.length);
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${path.split("?")[0]}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) {
      throw new Error(`fakePortal: no route for ${key}`);
    }
    const headers = new Headers(init?.headers);
    const cookies = new Map(
      (headers.get("cookie") ?? "")
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.includes("="))
        .map((part) => [part.slice(0, part.indexOf("=")), part.slice(part.indexOf("=") + 1)] as const),
    );
    const request: FakeRequest = {
      method,
      path,
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      cookie: (name) => cookies.get(name),
    };
    const reply = await handler(request);
    const responseHeaders = new Headers({ "content-type": "application/json" });
    for (const cookie of reply.cookies ?? []) {
      responseHeaders.append("set-cookie", cookie);
    }
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200, headers: responseHeaders });
  };

  return {
    fetch: fn as unknown as typeof fetch,
    calls,
    count: (call) => calls.filter((c) => c === call).length,
  };
}
