import type { Connector } from "@bixbd/utils-mcp-core";

import { bundled } from "./bundled";

export type Importer = (specifier: string) => Promise<unknown>;

// Connectors shipped inside this package load without any extra install step.
const defaultImporter: Importer = (specifier) => {
  const load = bundled[specifier];
  return load ? load() : import(specifier);
};

const ID = /^[a-z][a-z0-9-]*$/;

export const packageFor = (id: string) => `@bixbd/utils-mcp-connector-${id}`;

function isConnector(value: unknown): value is Connector {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.baseUrl === "string" &&
    Array.isArray(candidate.tools) &&
    typeof candidate.auth === "object" &&
    candidate.auth !== null
  );
}

/**
 * Loads each enabled connector. Connectors in this repository are bundled into
 * the server; anything else is imported by package name. Each must default-export a connector.
 */
export async function loadConnectors(
  ids: string[],
  importer: Importer = defaultImporter,
): Promise<Connector[]> {
  return Promise.all(
    ids.map(async (id) => {
      // Restrict what can be imported: only our own connector packages.
      if (!ID.test(id)) {
        throw new Error(`Invalid connector id "${id}". Use lowercase kebab-case.`);
      }
      const specifier = packageFor(id);
      let mod: unknown;
      try {
        mod = await importer(specifier);
      } catch {
        throw new Error(`Connector "${id}" is enabled but ${specifier} could not be loaded. Install it with: npm install ${specifier}`);
      }
      const connector = (mod as { default?: unknown }).default;
      if (!isConnector(connector)) {
        throw new Error(`${specifier} must default-export a connector made with defineConnector.`);
      }
      if (connector.id !== id) {
        throw new Error(`${specifier} exports connector "${connector.id}", expected "${id}".`);
      }
      return connector;
    }),
  );
}
