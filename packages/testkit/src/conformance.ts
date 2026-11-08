import type { Connector } from "@bixbd/utils-mcp-core";

const ID = /^[a-z][a-z0-9-]*$/;
const TOOL = /^[a-z]+(_[a-z0-9]+)+$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const STATUSES = new Set(["active", "beta", "broken", "deprecated"]);
const METHODS = new Set(["none", "apikey", "bearer", "form-login", "cookie-import"]);

/** Returns a list of rule violations. Empty list means the connector conforms. */
export function checkConformance(connector: Connector): string[] {
  const problems: string[] = [];
  if (!ID.test(connector.id)) {
    problems.push(`id "${connector.id}" must be lowercase kebab-case`);
  }
  if (!SEMVER.test(connector.version)) {
    problems.push(`version "${connector.version}" must be semver`);
  }
  if (!STATUSES.has(connector.status)) {
    problems.push(`status "${connector.status}" is invalid`);
  }
  if (connector.description.trim().length < 10) {
    problems.push("connector description is too short");
  }
  if (!URL.canParse(connector.baseUrl) || !connector.baseUrl.startsWith("https://")) {
    problems.push(`baseUrl "${connector.baseUrl}" must be an https URL`);
  }
  if (!METHODS.has(connector.auth.method)) {
    problems.push(`auth method "${connector.auth.method}" is invalid`);
  }
  if (connector.tools.length === 0) {
    problems.push("connector has no tools");
  }

  const seen = new Set<string>();
  for (const tool of connector.tools) {
    const label = `tool "${tool.name}"`;
    if (!TOOL.test(tool.name)) {
      problems.push(`${label}: name must be verb_noun snake_case`);
    }
    if (seen.has(tool.name)) {
      problems.push(`${label}: duplicate name`);
    }
    seen.add(tool.name);
    if (tool.description.trim().length < 20) {
      problems.push(`${label}: description must say what it does and when to use it (20+ chars)`);
    }
    if (tool.inputSchema.type !== "object") {
      problems.push(`${label}: input schema must be an object`);
    }
    if (tool.outputSchema.type !== "object") {
      problems.push(`${label}: output schema must be an object`);
    }
    if (tool.annotations.readOnlyHint && tool.annotations.destructiveHint) {
      problems.push(`${label}: cannot be both read-only and destructive`);
    }
  }
  return problems;
}
