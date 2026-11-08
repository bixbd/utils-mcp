import { defineConnector, defineTool, noAuth, z } from "@bixbd/utils-mcp-core";

// What we depend on in the portal's response. Anything else is ignored.
const RawStatus = z.object({
  state: z.string(),
  updated_at: z.string().nullish(),
});

/**
 * Reference connector. Generate a new one with `bun run new:connector <name>`.
 * Pattern: declare the portal and its auth, then per tool declare input,
 * output, and a handler that calls ctx.http and returns only what the AI needs.
 */
export const example = defineConnector({
  id: "example",
  version: "0.1.0",
  status: "beta",
  description: "Reference connector showing the connector pattern",
  baseUrl: "https://portal.example.test",
  auth: noAuth(),
  tools: [
    defineTool({
      name: "get_status",
      description: "Get the example portal's current service status. Use when asked if the portal is up.",
      access: "read",
      input: z.object({}),
      output: z.object({ state: z.string(), updatedAt: z.string().nullable() }),
      handler: async (_input, ctx) => {
        const raw = await ctx.http.json("/api/status", RawStatus);
        return { state: raw.state, updatedAt: raw.updated_at ?? null };
      },
    }),
  ],
});

export default example;
