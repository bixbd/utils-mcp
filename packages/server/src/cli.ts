#!/usr/bin/env bun
import { loadConfig } from "./config";
import { loadConnectors } from "./load";
import { startServer } from "./server";

// stdout is the MCP protocol channel. Log to stderr only.
const log = (message: string) => process.stderr.write(`utils-mcp: ${message}\n`);

try {
  const config = await loadConfig();
  if (config.enabled.length === 0) {
    log('no connectors enabled. Create ~/.utils-mcp/config.json with {"enabled": ["desco"]}.');
  }
  const connectors = await loadConnectors(config.enabled);
  await startServer(connectors, config.enabled);
} catch (error) {
  log(error instanceof Error ? error.message : "failed to start");
  process.exit(1);
}
