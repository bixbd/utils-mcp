import { maskLast4 } from "@bixbd/utils-mcp-core";

const MASKED_KEYS = new Set(["accountNo", "meterNo", "consumerNo"]);

/** Masks account and meter numbers to the last 4 digits anywhere in a passthrough payload. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        MASKED_KEYS.has(key) && typeof v === "string" ? maskLast4(v) : redact(v),
      ]),
    );
  }
  return value;
}
