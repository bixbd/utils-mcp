import { toErrorPayload, UtilsError, type ToolErrorPayload } from "./errors";
import type { Connector, ToolAnnotations, ToolContext, ToolDef, JsonSchema } from "./types";
import { validateInput } from "./validate";

export type RegisteredTool = {
  name: string;
  connectorId: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
};

export type CallResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ToolErrorPayload };

export type Registry = {
  listTools(): RegisteredTool[];
  callTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<CallResult>;
};

export const toolName = (connectorId: string, tool: string) => `${connectorId}_${tool}`;

export function createRegistry(connectors: Connector[], enabled?: string[]): Registry {
  const active = connectors.filter(
    (c) => c.status !== "broken" && (enabled === undefined || enabled.includes(c.id)),
  );
  const byName = new Map<string, { connector: Connector; tool: ToolDef }>();
  for (const connector of active) {
    for (const tool of connector.tools) {
      const name = toolName(connector.id, tool.name);
      if (byName.has(name)) {
        throw new Error(`Duplicate tool name: ${name}`);
      }
      byName.set(name, { connector, tool });
    }
  }

  return {
    listTools() {
      return [...byName.entries()].map(([name, { connector, tool }]) => ({
        name,
        connectorId: connector.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }));
    },
    async callTool(name, input, ctx) {
      try {
        const entry = byName.get(name);
        if (!entry) {
          throw new UtilsError("UNKNOWN_TOOL", `Unknown tool: ${name}`, "List the available tools and retry.");
        }
        validateInput(entry.tool.inputSchema, input);
        const data = await entry.tool.handler(input, ctx);
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: toErrorPayload(error) };
      }
    },
  };
}
