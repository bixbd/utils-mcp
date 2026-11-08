import type { z } from "zod/v4";
import { UtilsError } from "./errors";
import { createSessionFetch, type SessionFetch } from "./session-fetch";
import type { AuthHelpers, Connector, Http, RequestOptions, RuntimeContext } from "./types";

type Session = { cookies: SessionFetch; loggedIn: boolean };

// One session per (fetch implementation, connector, account). Cookies live in memory only.
const sessions = new WeakMap<typeof fetch, Map<string, Session>>();

function sessionFor(runtime: RuntimeContext, key: string): Session {
  let byKey = sessions.get(runtime.fetch);
  if (!byKey) {
    byKey = new Map();
    sessions.set(runtime.fetch, byKey);
  }
  let session = byKey.get(key);
  if (!session) {
    session = { cookies: createSessionFetch(runtime.fetch), loggedIn: false };
    byKey.set(key, session);
  }
  return session;
}

export function createHttp(
  connector: Pick<Connector, "id" | "baseUrl" | "auth">,
  runtime: RuntimeContext,
): Http {
  const { id, baseUrl, auth } = connector;
  const session = sessionFor(runtime, `${id}:${runtime.account}`);

  const helpers: AuthHelpers = {
    connectorId: id,
    account: runtime.account,
    secrets: runtime.secrets,
    fetch: session.cookies.fetch,
    cookie: (name) => session.cookies.cookie(name),
    url: (path) => `${baseUrl}${path}`,
  };

  async function send(path: string, options: RequestOptions, retried: boolean): Promise<unknown> {
    if (!session.loggedIn && auth.login) {
      await auth.login(helpers);
      session.loggedIn = true;
    }
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...auth.headers?.(helpers, { method }),
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await helpers.fetch(helpers.url(path), {
      method,
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });

    if (response.status === 401) {
      if (!auth.login) {
        throw new UtilsError("AUTH_REQUIRED", `${id} rejected the credentials`, "Check the API key or token and restart the server.");
      }
      session.loggedIn = false;
      session.cookies.clear();
      if (retried) {
        throw new UtilsError(
          "AUTH_EXPIRED",
          `${id} rejected the session right after login`,
          "Check the credentials, or sign in on the portal to see if the account needs attention.",
        );
      }
      return send(path, options, true);
    }
    if (!response.ok) {
      throw new UtilsError("UPSTREAM_ERROR", `${id} returned HTTP ${response.status}`, "Try again later.");
    }
    try {
      return await response.json();
    } catch {
      throw new UtilsError("UPSTREAM_CHANGED", `${id} returned a response that is not JSON`, "The portal changed. Update the connector.");
    }
  }

  return {
    async json<T extends z.ZodType>(path: string, schema: T, options: RequestOptions = {}) {
      const raw = await send(path, options, false);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        // Report where the shape differs, never the values: they may be private.
        const where = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
        throw new UtilsError(
          "UPSTREAM_CHANGED",
          `${id} response no longer matches the expected shape at: ${where}`,
          "The portal changed its format. Update the connector's response schema and fixtures.",
        );
      }
      return parsed.data;
    },
  };
}
