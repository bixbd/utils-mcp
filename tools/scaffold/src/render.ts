export const CONNECTOR_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const toCamel = (name: string) => name.replaceAll(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
export const toEnvPrefix = (name: string) => name.toUpperCase().replaceAll("-", "_");

/** Returns the files for a new connector, keyed by path relative to connectors/<name>/. */
export function renderConnector(name: string): Record<string, string> {
  if (!CONNECTOR_NAME.test(name)) {
    throw new Error(`Invalid connector name "${name}". Use lowercase kebab-case, for example acme-portal.`);
  }
  const camel = toCamel(name);
  const env = toEnvPrefix(name);

  return {
    "package.json": `${JSON.stringify(
      {
        name: `@bixbd/utils-mcp-connector-${name}`,
        version: "0.0.0",
        type: "module",
        main: "src/index.ts",
        types: "src/index.ts",
        scripts: {
          build: `echo "${name}: no build step"`,
          typecheck: "tsc --noEmit",
          test: "bun test",
        },
        dependencies: { "@bixbd/utils-mcp-core": "workspace:*" },
        devDependencies: { "@bixbd/utils-mcp-testkit": "workspace:*" },
      },
      null,
      2,
    )}\n`,
    "tsconfig.json": `{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }\n`,
    "src/index.ts": `import { apiKey, defineConnector, defineTool, z } from "@bixbd/utils-mcp-core";

// What we depend on in the portal's response. Update to match the real API.
const RawStatus = z.object({ state: z.string() });

export const ${camel} = defineConnector({
  id: "${name}",
  version: "0.1.0",
  status: "beta",
  description: "TODO: one line about this portal",
  baseUrl: "https://TODO.example.com/api",
  auth: apiKey({ header: "X-API-Key", secret: "${env}_API_KEY" }),
  tools: [
    defineTool({
      name: "get_status",
      description: "TODO: say what this does and when the AI should use it.",
      access: "read",
      input: z.object({}),
      output: z.object({ state: z.string() }),
      handler: async (_input, ctx) => {
        const raw = await ctx.http.json("/status", RawStatus);
        return { state: raw.state };
      },
    }),
  ],
});

export default ${camel};
`,
    "test/connector.test.ts": `import { describe, expect, test } from "bun:test";
import { createRegistry, envSecrets } from "@bixbd/utils-mcp-core";
import { checkConformance, fakePortal } from "@bixbd/utils-mcp-testkit";
import { ${camel} } from "../src";

const portal = () =>
  fakePortal("https://TODO.example.com/api", {
    "GET /status": (req) =>
      req.headers.get("x-api-key") === "test-key" ? { body: { state: "ok" } } : { status: 401 },
  });

const run = (fetchImpl: typeof fetch, env: Record<string, string>) =>
  createRegistry([${camel}]).callTool("${name}_get_status", {}, {
    account: "default",
    fetch: fetchImpl,
    secrets: envSecrets("default", env),
  });

describe("${name} connector", () => {
  test("conforms to the connector standard", () => {
    expect(checkConformance(${camel})).toEqual([]);
  });

  test("returns the status", async () => {
    const result = await run(portal().fetch, { ${env}_API_KEY: "test-key" });
    expect(result).toEqual({ ok: true, data: { state: "ok" } });
  });

  test("explains how to set the key when it is missing", async () => {
    const result = await run(portal().fetch, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.hint).toContain("${env}_API_KEY");
    }
  });
});
`,
    "README.md": `# ${name} connector

TODO: what this portal is, and a link to its docs.

## Tools

| Tool | What it does |
| --- | --- |
| \`${name}_get_status\` | TODO |

## Credentials

Set in the MCP server environment (stays on your machine):

\`\`\`
${env}_API_KEY=...
\`\`\`

For a second account, add the suffix and pass \`account\` in the tool call: \`${env}_API_KEY__OFFICE\`.

## Notes

- TODO: auth quirks, rate limits, anything that breaks easily.
`,
    "fixtures/.gitkeep": "",
  };
}
