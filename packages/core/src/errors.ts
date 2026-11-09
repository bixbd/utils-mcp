export type ErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "NOT_FOUND"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "UPSTREAM_CHANGED"
  | "UPSTREAM_ERROR"
  | "CONNECTOR_DISABLED"
  | "UNKNOWN_TOOL";

export class UtilsError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;

  constructor(code: ErrorCode, message: string, hint: string) {
    super(message);
    this.name = "UtilsError";
    this.code = code;
    this.hint = hint;
  }
}

export type ToolErrorPayload = { code: ErrorCode | "INTERNAL"; message: string; hint: string };

export function toErrorPayload(error: unknown): ToolErrorPayload {
  if (error instanceof UtilsError) {
    return { code: error.code, message: error.message, hint: error.hint };
  }
  return {
    code: "INTERNAL",
    message: error instanceof Error ? error.message : "Unknown error",
    hint: "Run `utils-mcp doctor` to check the connector.",
  };
}
