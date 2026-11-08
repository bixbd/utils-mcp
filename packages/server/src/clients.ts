import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type Entry = { command: string; args: string[]; env: Record<string, string> };

/** An AI app whose config is a JSON file that holds a map of MCP servers. */
export type JsonClient = { name: string; file: string; key: "mcpServers" | "servers" };

export function jsonClients(
  platform: NodeJS.Platform = process.platform,
  home = homedir(),
  appData = process.env.APPDATA ?? join(home, "AppData", "Roaming"),
): JsonClient[] {
  const base: Record<string, string> = {
    darwin: join(home, "Library", "Application Support"),
    win32: appData,
  };
  const root = base[platform] ?? join(home, ".config");
  const desktop = join(root, "Claude", "claude_desktop_config.json");
  const vscode = join(root, "Code", "User", "mcp.json");
  return [
    { name: "Claude Desktop", file: desktop, key: "mcpServers" },
    { name: "Cursor", file: join(home, ".cursor", "mcp.json"), key: "mcpServers" },
    { name: "Windsurf", file: join(home, ".codeium", "windsurf", "mcp_config.json"), key: "mcpServers" },
    { name: "Gemini CLI", file: join(home, ".gemini", "settings.json"), key: "mcpServers" },
    { name: "VS Code", file: vscode, key: "servers" },
  ];
}

/** An app counts as installed when its config folder exists. */
export const isInstalled = (client: JsonClient) => existsSync(dirname(client.file));

/**
 * Adds or replaces our server entry and keeps everything else in the file.
 * Throws on a file we cannot parse so we never overwrite someone's config.
 */
export function mergeServer(existing: string | undefined, key: JsonClient["key"], entry: Entry): string {
  let data: Record<string, unknown> = {};
  if (existing !== undefined && existing.trim() !== "") {
    try {
      data = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      throw new Error("the config file is not valid JSON, so it was left untouched");
    }
  }
  const servers = (typeof data[key] === "object" && data[key] !== null ? data[key] : {}) as Record<string, unknown>;
  return `${JSON.stringify({ ...data, [key]: { ...servers, utils: entry } }, null, 2)}\n`;
}

/** The command apps should run. GUI apps often lack the shell PATH, so prefer npx next to this node. */
export function launchCommand(
  platform: NodeJS.Platform = process.platform,
  nodePath = process.execPath,
): Pick<Entry, "command" | "args"> {
  const sibling = join(dirname(nodePath), platform === "win32" ? "npx.cmd" : "npx");
  const npx = existsSync(sibling) ? sibling : "npx";
  return { command: npx, args: ["-y", "@bixbd/utils-mcp"] };
}
