import { describe, expect, test } from "bun:test";
import { defineConnector, defineTool, noAuth, z } from "@bixbd/utils-mcp-core";
import { loadConnectors, packageFor } from "../src/load";

const make = (id: string) =>
  defineConnector({
    id,
    version: "0.1.0",
    status: "active",
    description: "Test connector",
    baseUrl: "https://t.test",
    auth: noAuth(),
    tools: [
      defineTool({
        name: "get_thing",
        description: "Gets a thing. Use in tests only.",
        access: "read",
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({}),
      }),
    ],
  });

const importerFor = (modules: Record<string, unknown>) => async (specifier: string) => {
  if (!(specifier in modules)) {
    throw new Error("not installed");
  }
  return modules[specifier];
};

describe("loadConnectors", () => {
  test("loads each enabled connector from its own package", async () => {
    const loaded = await loadConnectors(
      ["alpha", "beta"],
      importerFor({ [packageFor("alpha")]: { default: make("alpha") }, [packageFor("beta")]: { default: make("beta") } }),
    );
    expect(loaded.map((c) => c.id)).toEqual(["alpha", "beta"]);
  });

  test("tells the user how to install a missing connector", async () => {
    await expect(loadConnectors(["alpha"], importerFor({}))).rejects.toThrow("npm install @bixbd/utils-mcp-connector-alpha");
  });

  test("rejects ids that could import arbitrary packages", async () => {
    await expect(loadConnectors(["../evil"], importerFor({}))).rejects.toThrow("Invalid connector id");
    await expect(loadConnectors(["Evil_Pkg"], importerFor({}))).rejects.toThrow("Invalid connector id");
  });

  test("rejects a package that does not default-export a connector", async () => {
    await expect(
      loadConnectors(["alpha"], importerFor({ [packageFor("alpha")]: { default: { nope: true } } })),
    ).rejects.toThrow("defineConnector");
  });

  test("rejects a package whose connector id does not match", async () => {
    await expect(
      loadConnectors(["alpha"], importerFor({ [packageFor("alpha")]: { default: make("other") } })),
    ).rejects.toThrow('expected "alpha"');
  });

  test("returns nothing for an empty list", async () => {
    expect(await loadConnectors([], importerFor({}))).toEqual([]);
  });
});
