import { toErrorPayload, UtilsError, type ToolErrorPayload } from "./errors";
import { createHttp } from "./http";
import type { JsonSchema } from "./schema";
import type { Connector, RuntimeContext, ToolAnnotations, ToolDef } from "./types";

export type RegisteredTool = {
  name: string;
  connectorId: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: ToolAnnotations;
};

export type CallResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ToolErrorPayload };

export type Registry = {
  listTools(): RegisteredTool[];
  callTool(name: string, input: Record<string, unknown>, runtime: RuntimeContext): Promise<CallResult>;
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
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      }));
    },
    async callTool(name, input, runtime) {
      try {
        const entry = byName.get(name);
        if (!entry) {
          throw new UtilsError("UNKNOWN_TOOL", `Unknown tool: ${name}`, "List the available tools and retry.");
        }
        const http = createHttp(entry.connector, runtime);
        const data = await entry.tool.run(input, { ...runtime, http });
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error: toErrorPayload(error) };
      }
    },
  };
}
