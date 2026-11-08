import { UtilsError } from "./errors";
import type { JsonSchema } from "./types";

/** Minimal validator for the flat object schemas connectors use. */
export function validateInput(schema: JsonSchema, input: Record<string, unknown>): void {
  for (const key of schema.required ?? []) {
    if (input[key] === undefined || input[key] === null || input[key] === "") {
      throw new UtilsError(
        "INVALID_INPUT",
        `Missing required input: ${key}`,
        `Provide "${key}" and call the tool again.`,
      );
    }
  }
  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    const ok =
      spec.type === "integer"
        ? Number.isInteger(value)
        : typeof value === spec.type;
    if (!ok) {
      throw new UtilsError(
        "INVALID_INPUT",
        `Input "${key}" must be a ${spec.type}`,
        `Pass "${key}" as a ${spec.type}.`,
      );
    }
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(input)) {
      if (!(key in (schema.properties ?? {}))) {
        throw new UtilsError("INVALID_INPUT", `Unknown input: ${key}`, "Remove the unknown field.");
      }
    }
  }
}
