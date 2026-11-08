import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type Config = { enabled: string[] };

export const DEFAULT_CONFIG: Config = { enabled: [] };

export function configPath(env: Record<string, string | undefined> = process.env): string {
  return env.UTILS_MCP_CONFIG ?? join(homedir(), ".utils-mcp", "config.json");
}

export function parseConfig(raw: string): Config {
  const data = JSON.parse(raw) as { enabled?: unknown };
  if (!Array.isArray(data.enabled) || !data.enabled.every((x) => typeof x === "string")) {
    throw new Error('Config must look like {"enabled": ["connector-id"]}');
  }
  return { enabled: data.enabled as string[] };
}

export async function loadConfig(path = configPath()): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
  return parseConfig(raw);
}
