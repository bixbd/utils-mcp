export type JsonSchema = {
  type: "object";
  properties?: Record<string, { type: "string" | "number" | "boolean" | "integer"; description?: string }>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint?: boolean;
};

export type AuthMethod = "none" | "apikey" | "bearer" | "form-login" | "cookie-import";

export type ToolContext = {
  /** Account label chosen for this call (default account if omitted). */
  account: string;
  /** Fetch bound to the account's session (cookies/headers applied). */
  fetch: typeof fetch;
};

export type ToolDef = {
  /** verb_noun, e.g. get_status. Registry prefixes it with the connector id. */
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

export type ConnectorStatus = "active" | "beta" | "broken" | "deprecated";

export type Connector = {
  id: string;
  version: string;
  status: ConnectorStatus;
  description: string;
  auth: AuthMethod[];
  tools: ToolDef[];
};
