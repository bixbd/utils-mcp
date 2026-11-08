import type { AuthStrategy, Connector, ConnectorStatus, ToolDef } from "./types";

export type ConnectorSpec = {
  /** Lowercase kebab-case. Also the tool name prefix and the npm package suffix. */
  id: string;
  version: string;
  status: ConnectorStatus;
  description: string;
  /** Portal root. Tool paths are relative to it. */
  baseUrl: string;
  auth: AuthStrategy;
  tools: ToolDef[];
};

export function defineConnector(spec: ConnectorSpec): Connector {
  return { ...spec, baseUrl: spec.baseUrl.replace(/\/+$/, "") };
}
