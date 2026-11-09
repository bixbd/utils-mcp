import type { z } from "zod/v4";
import type { JsonSchema } from "./schema";

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
};

export type Access = "read" | "write" | "destructive";

export type AuthMethod = "none" | "apikey" | "bearer" | "form-login" | "cookie-import";

export type SecretReader = {
  /** Returns a secret for the current account, or undefined if it is not configured. */
  get(name: string): string | undefined;
};

/** What the server provides for every tool call. */
export type RuntimeContext = {
  /** Account label chosen for this call. */
  account: string;
  /** The raw fetch. Connectors should use ctx.http instead. */
  fetch: typeof fetch;
  /** Credentials for the current account. Never log these. */
  secrets: SecretReader;
};

export type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; form?: Record<string, string> };

/** Authenticated, session-aware client for one connector and account. */
export type Http = {
  /** Read HTML using the same session and error handling as JSON requests. */
  text(path: string, options?: RequestOptions): Promise<string>;
  /**
   * Calls the portal and validates the response against `schema`.
   * Handles login, session expiry, error mapping and drift detection.
   */
  json<T extends z.ZodType>(path: string, schema: T, options?: RequestOptions): Promise<z.infer<T>>;
};

/** What a tool handler receives. */
export type ToolContext = RuntimeContext & { http: Http };

/** A tool after defineTool: schemas are erased so connectors can hold a mixed list. */
export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: ToolAnnotations;
  /** Validates input, runs the handler, validates output. Throws UtilsError on failure. */
  run(input: unknown, ctx: ToolContext): Promise<unknown>;
};

export type ConnectorStatus = "active" | "beta" | "broken" | "deprecated";

export type AuthHelpers = {
  connectorId: string;
  account: string;
  secrets: SecretReader;
  /** Fetch that keeps cookies for this session. */
  fetch: typeof fetch;
  cookie(name: string): string | undefined;
  /** Joins the connector's baseUrl and a path. */
  url(path: string): string;
};

export type AuthStrategy = {
  method: AuthMethod;
  /** Establish a session. Called before the first request and after a 401. */
  login?(helpers: AuthHelpers): Promise<void>;
  /** Extra headers for every request. */
  headers?(helpers: AuthHelpers, request: { method: string }): Record<string, string>;
};

export type Connector = {
  id: string;
  version: string;
  status: ConnectorStatus;
  description: string;
  baseUrl: string;
  auth: AuthStrategy;
  tools: ToolDef[];
};
