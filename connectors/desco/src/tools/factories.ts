import { defineTool, z } from "@bixbd/utils-mcp-core";
import { redact, resolveAccountId, withQuery, type QueryValue } from "../client";
import { DataOut } from "../schemas";

const Loose = z.unknown();

export const accountIdInput = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Internal accountId from desco_list_accounts. Omit if only one account is linked.");

export const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional();
export const monthInput = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM").optional();

/** A public endpoint with no input. */
export const publicGet = (name: string, description: string, path: string) =>
  defineTool({
    name,
    description,
    access: "read",
    input: z.object({}),
    output: DataOut,
    handler: async (_input, ctx) => ({ data: await ctx.http.json(path, Loose) }),
  });

/** A public paged search. Every input field becomes a query parameter. */
export const publicSearch = (name: string, description: string, path: string, shape: z.ZodRawShape) =>
  defineTool({
    name,
    description,
    access: "read",
    input: z.object({
      ...shape,
      page: z.number().int().min(0).optional().describe("Zero-based page number."),
      size: z.number().int().min(1).max(50).optional().describe("Results per page."),
    }),
    output: DataOut,
    handler: async (input, ctx) => ({
      data: await ctx.http.json(withQuery(path, input as Record<string, QueryValue>), Loose),
    }),
  });

/** A signed-in endpoint under /accounts/{id}. Fields other than accountId become query parameters. */
export const accountGet = (name: string, description: string, suffix: string, shape: z.ZodRawShape = {}) =>
  defineTool({
    name,
    description,
    access: "read",
    input: z.object({ accountId: accountIdInput, ...shape }),
    output: DataOut,
    handler: async (input, ctx) => {
      const { accountId: given, ...query } = input as { accountId?: number } & Record<string, QueryValue>;
      const accountId = given ?? (await resolveAccountId(ctx));
      const path = withQuery(`/accounts/${accountId}${suffix}`, query);
      return { data: redact(await ctx.http.json(path, Loose)) };
    },
  });
