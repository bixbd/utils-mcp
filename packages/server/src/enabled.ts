import { bundled } from "./bundled";
import { packageFor } from "./load";

const PREFIX = packageFor("");

export const bundledIds = (): string[] =>
  Object.keys(bundled)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => name.slice(PREFIX.length));

/**
 * Which connectors to run, most specific first:
 * UTILS_MCP_ENABLED (comma separated), then config.json, then every bundled connector.
 * The default means a client config needs only the command and the portal login.
 */
export function resolveEnabled(
  fromConfig: string[],
  env: Record<string, string | undefined> = process.env,
): string[] {
  const fromEnv = (env.UTILS_MCP_ENABLED ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  return fromConfig.length > 0 ? fromConfig : bundledIds();
}
