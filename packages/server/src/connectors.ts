import type { Connector } from "@bixbd/utils-mcp-core";
import { example } from "@bixbd/utils-mcp-connector-example";

/** Every connector the package knows about. Enabling is controlled by config. */
export const allConnectors: Connector[] = [example];
