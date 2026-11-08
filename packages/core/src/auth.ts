import { UtilsError } from "./errors";
import { secretEnvName } from "./secrets";
import type { AuthHelpers, AuthStrategy } from "./types";

function requireSecret(helpers: AuthHelpers, name: string): string {
  const value = helpers.secrets.get(name);
  if (value === undefined) {
    throw new UtilsError(
      "AUTH_REQUIRED",
      `${helpers.connectorId} credentials are not set for account "${helpers.account}"`,
      `Set ${secretEnvName(name, helpers.account)} in the MCP server environment.`,
    );
  }
  return value;
}

export const noAuth = (): AuthStrategy => ({ method: "none" });

/** Sends a secret in a custom header, for example X-API-Key. */
export function apiKey(options: { header: string; secret: string }): AuthStrategy {
  return {
    method: "apikey",
    headers: (helpers) => ({ [options.header]: requireSecret(helpers, options.secret) }),
  };
}

/** Sends `Authorization: Bearer <secret>`. */
export function bearer(options: { secret: string }): AuthStrategy {
  return {
    method: "bearer",
    headers: (helpers) => ({ Authorization: `Bearer ${requireSecret(helpers, options.secret)}` }),
  };
}

export type FormLoginOptions = {
  /** GET this first to receive the CSRF cookie. Omit if the portal has no CSRF step. */
  csrfPath?: string;
  loginPath: string;
  /** Names of the secrets that hold the credentials, for example DESCO_USERNAME. */
  secrets: { username: string; password: string };
  /** JSON body field names. Defaults to username and password. */
  fields?: { username: string; password: string };
  csrfCookie?: string;
  csrfHeader?: string;
};

/** JSON login with session cookies and optional double-submit CSRF. */
export function formLogin(options: FormLoginOptions): AuthStrategy {
  const csrfCookie = options.csrfCookie ?? "XSRF-TOKEN";
  const csrfHeader = options.csrfHeader ?? "X-XSRF-TOKEN";
  const fields = options.fields ?? { username: "username", password: "password" };

  const tokenHeader = (helpers: AuthHelpers): Record<string, string> => {
    const raw = helpers.cookie(csrfCookie);
    return raw === undefined ? {} : { [csrfHeader]: decodeURIComponent(raw) };
  };

  return {
    method: "form-login",
    async login(helpers) {
      const username = requireSecret(helpers, options.secrets.username);
      const password = requireSecret(helpers, options.secrets.password);
      const id = helpers.connectorId;

      if (options.csrfPath !== undefined) {
        const csrf = await helpers.fetch(helpers.url(options.csrfPath), {
          headers: { Accept: "application/json" },
        });
        if (!csrf.ok) {
          throw new UtilsError("UPSTREAM_ERROR", `${id} returned HTTP ${csrf.status} for the CSRF request`, "Try again later.");
        }
        if (helpers.cookie(csrfCookie) === undefined) {
          throw new UtilsError(
            "UPSTREAM_CHANGED",
            `${id} did not return a ${csrfCookie} cookie`,
            "The portal login flow changed. Update the connector.",
          );
        }
      }

      const response = await helpers.fetch(helpers.url(options.loginPath), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...tokenHeader(helpers) },
        body: JSON.stringify({ [fields.username]: username, [fields.password]: password }),
      });
      if (response.status === 401 || response.status === 403) {
        throw new UtilsError(
          "AUTH_REQUIRED",
          `${id} rejected the username or password`,
          "Fix the credentials and restart the server. A rejected login is never retried, so it can't lock the account.",
        );
      }
      if (!response.ok) {
        throw new UtilsError("UPSTREAM_ERROR", `${id} returned HTTP ${response.status} for login`, "Try again later.");
      }
    },
    headers: (helpers, request) => (request.method === "GET" ? {} : tokenHeader(helpers)),
  };
}
