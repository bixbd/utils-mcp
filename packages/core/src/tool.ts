import type { z } from "zod/v4";
import { UtilsError } from "./errors";
import { toJsonSchema } from "./schema";
import type { Access, ToolAnnotations, ToolContext, ToolDef } from "./types";

export type ToolSpec<I extends z.ZodObject, O extends z.ZodObject> = {
  /** verb_noun in snake_case, for example get_balance. The registry adds the connector prefix. */
  name: string;
  /** What it does and when to use it. Written for the AI, not for developers. */
  description: string;
  /** read: no side effects. write: changes data. destructive: deletes or spends. */
  access: Access;
  input: I;
  output: O;
  handler(input: z.infer<I>, ctx: ToolContext): Promise<z.infer<O>>;
};

const annotationsFor = (access: Access): ToolAnnotations => ({
  readOnlyHint: access === "read",
  destructiveHint: access === "destructive",
  idempotentHint: access === "read",
});

const describeIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");

export function defineTool<I extends z.ZodObject, O extends z.ZodObject>(spec: ToolSpec<I, O>): ToolDef {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: toJsonSchema(spec.input, "input"),
    outputSchema: toJsonSchema(spec.output, "output"),
    annotations: annotationsFor(spec.access),
    async run(rawInput, ctx) {
      const input = spec.input.safeParse(rawInput);
      if (!input.success) {
        throw new UtilsError(
          "INVALID_INPUT",
          `Invalid input. ${describeIssues(input.error)}`,
          "Fix the listed fields and call the tool again.",
        );
      }
      const result = await spec.handler(input.data, ctx);
      const output = spec.output.safeParse(result);
      if (!output.success) {
        throw new Error(`${spec.name} returned data that does not match its output schema (${describeIssues(output.error)})`);
      }
      return output.data;
    },
  };
}
