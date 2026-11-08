#!/usr/bin/env bun
import { allConnectors } from "./connectors";
import { loadConfig } from "./config";
import { startServer } from "./server";

// stdout is the MCP protocol channel. Log to stderr only.
const config = await loadConfig();
await startServer(allConnectors, config.enabled);
