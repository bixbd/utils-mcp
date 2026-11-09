/**
 * Connectors built into the server so users install a single package.
 * Keys are package names; literal specifiers let the bundler inline them.
 */
export const bundled: Record<string, () => Promise<unknown>> = {
  "@bixbd/utils-mcp-connector-nesco": () => import("@bixbd/utils-mcp-connector-nesco"),
  "@bixbd/utils-mcp-connector-desco": () => import("@bixbd/utils-mcp-connector-desco"),
};
