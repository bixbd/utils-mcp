#!/usr/bin/env node
import { loadConfig } from "./config";
import { resolveEnabled } from "./enabled";
import { loadConnectors } from "./load";
import { startServer } from "./server";

// stdout is the MCP protocol channel. Log to stderr only.
const log = (message: string) => process.stderr.write(`utils-mcp: ${message}\n`);

if (process.argv[2] === "setup") {
  const { runSetup } = await import("./setup");
  await runSetup();
  process.exit(0);
}

try {
  const config = await loadConfig();
  const enabled = resolveEnabled(config.enabled);
  const connectors = await loadConnectors(enabled);
  await startServer(connectors, enabled);
} catch (error) {
  log(error instanceof Error ? error.message : "failed to start");
  process.exit(1);
}
