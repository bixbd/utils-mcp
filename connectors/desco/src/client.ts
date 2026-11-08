import {
  createSessionFetch,
  secretEnvName,
  UtilsError,
  type SessionFetch,
  type ToolContext,
} from "@bixbd/utils-mcp-core";

export const BASE_URL = "https://prepaid.desco.org.bd/api";

type Session = { http: SessionFetch; loggedIn: boolean };

// One session per (fetch implementation, account). Cookies live in memory only.
const sessions = new WeakMap<typeof fetch, Map<string, Session>>();

function sessionFor(ctx: ToolContext): Session {
  let byAccount = sessions.get(ctx.fetch);
  if (!byAccount) {
    byAccount = new Map();
    sessions.set(ctx.fetch, byAccount);
  }
  let session = byAccount.get(ctx.account);
  if (!session) {
    session = { http: createSessionFetch(ctx.fetch), loggedIn: false };
    byAccount.set(ctx.account, session);
  }
  return session;
}

function csrfHeader(session: Session): Record<string, string> {
  const raw = session.http.cookie("XSRF-TOKEN");
  if (raw === undefined) {
    throw new UtilsError(
      "UPSTREAM_CHANGED",
      "DESCO did not return an XSRF-TOKEN cookie",
      "The portal login flow changed. Re-check the flow and update the connector.",
    );
  }
  return { "X-XSRF-TOKEN": decodeURIComponent(raw) };
}

async function login(ctx: ToolContext, session: Session): Promise<void> {
  const username = ctx.secrets.get("DESCO_USERNAME");
  const password = ctx.secrets.get("DESCO_PASSWORD");
  if (username === undefined || password === undefined) {
    throw new UtilsError(
      "AUTH_REQUIRED",
      `DESCO credentials are not set for account "${ctx.account}"`,
      `Set ${secretEnvName("DESCO_USERNAME", ctx.account)} and ${secretEnvName("DESCO_PASSWORD", ctx.account)} in the MCP server environment.`,
    );
  }

  const csrf = await session.http.fetch(`${BASE_URL}/auth/csrf`, {
    headers: { Accept: "application/json" },
  });
  if (!csrf.ok) {
    throw new UtilsError("UPSTREAM_ERROR", `DESCO returned HTTP ${csrf.status} for the CSRF request`, "Try again later.");
  }

  const response = await session.http.fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeader(session),
    },
    body: JSON.stringify({ username, password }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new UtilsError(
      "AUTH_REQUIRED",
      "DESCO rejected the username or password",
      "Fix the credentials and restart the server. The connector does not retry a rejected login, so it can't lock the account.",
    );
  }
  if (!response.ok) {
    throw new UtilsError("UPSTREAM_ERROR", `DESCO returned HTTP ${response.status} for login`, "Try again later.");
  }
  session.loggedIn = true;
}

/** GET a protected endpoint. Logs in on first use, and once more if the session expired. */
export async function getJson(ctx: ToolContext, path: string, retried = false): Promise<unknown> {
  const session = sessionFor(ctx);
  if (!session.loggedIn) {
    await login(ctx, session);
  }
  const response = await session.http.fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) {
    session.loggedIn = false;
    session.http.clear();
    if (retried) {
      throw new UtilsError(
        "AUTH_EXPIRED",
        "DESCO session was rejected right after login",
        "Check the credentials, or sign in on the DESCO portal to see if the account needs attention.",
      );
    }
    return getJson(ctx, path, true);
  }
  if (!response.ok) {
    throw new UtilsError("UPSTREAM_ERROR", `DESCO returned HTTP ${response.status}`, "Try again later.");
  }
  try {
    return await response.json();
  } catch {
    throw new UtilsError(
      "UPSTREAM_CHANGED",
      "DESCO returned a response that is not JSON",
      "The portal changed. Update the connector parser.",
    );
  }
}
