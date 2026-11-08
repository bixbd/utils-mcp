import { UtilsError, type Connector } from "@bixbd/utils-mcp-core";

const BASE_URL = "https://portal.example.test";

/**
 * Reference connector. Copy this folder to start a new one.
 * Pattern: call the portal with ctx.fetch, parse, and return only the fields the AI needs.
 */
export const example: Connector = {
  id: "example",
  version: "0.1.0",
  status: "beta",
  description: "Reference connector showing the connector pattern",
  auth: ["none"],
  tools: [
    {
      name: "get_status",
      description: "Get the example portal's current service status. Use when asked if the portal is up.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      handler: async (_input, ctx) => {
        const res = await ctx.fetch(`${BASE_URL}/api/status`);
        if (!res.ok) {
          throw new UtilsError(
            "UPSTREAM_ERROR",
            `Portal returned HTTP ${res.status}`,
            "Try again later, or run `utils-mcp doctor` to check the connector.",
          );
        }
        const body = (await res.json()) as { state?: unknown; updated_at?: unknown };
        if (typeof body.state !== "string") {
          throw new UtilsError(
            "UPSTREAM_CHANGED",
            "Portal response no longer has a `state` field",
            "The portal changed its format. Update the connector parser and fixtures.",
          );
        }
        return { state: body.state, updatedAt: body.updated_at ?? null };
      },
    },
  ],
};
