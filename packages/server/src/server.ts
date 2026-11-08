import { createRegistry, type Connector } from "@bixbd/utils-mcp-core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildContext, splitAccount, withAccountInput } from "./context";

export async function startServer(connectors: Connector[], enabled: string[]): Promise<void> {
  const registry = createRegistry(connectors, enabled);
  const server = new Server({ name: "utils-mcp", version: "0.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: withAccountInput(t.inputSchema),
      outputSchema: t.outputSchema,
      annotations: t.annotations,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const { account, input } = splitAccount(args);
    const result = await registry.callTool(request.params.name, input, buildContext(account));
    if (result.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify(result.data) }],
        structuredContent: result.data as Record<string, unknown>,
      };
    }
    return { isError: true, content: [{ type: "text", text: JSON.stringify(result.error) }] };
  });

  await server.connect(new StdioServerTransport());
}
