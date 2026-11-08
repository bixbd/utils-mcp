import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configPath, DEFAULT_CONFIG, loadConfig, parseConfig } from "../src/config";

describe("config", () => {
  test("parses enabled connectors", () => {
    expect(parseConfig('{"enabled":["example","portalx"]}')).toEqual({ enabled: ["example", "portalx"] });
  });

  test("rejects a malformed config", () => {
    expect(() => parseConfig('{"enabled":"example"}')).toThrow("enabled");
  });

  test("nothing is enabled by default", () => {
    expect(DEFAULT_CONFIG.enabled).toEqual([]);
  });

  test("UTILS_MCP_CONFIG overrides the default path", () => {
    expect(configPath({ UTILS_MCP_CONFIG: "/tmp/c.json" })).toBe("/tmp/c.json");
  });

  test("default path lives under the home directory", () => {
    expect(configPath({})).toContain(".utils-mcp");
  });

  test("loadConfig returns the default when the file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "utils-mcp-"));
    expect(await loadConfig(join(dir, "none.json"))).toEqual(DEFAULT_CONFIG);
  });

  test("loadConfig reads an existing file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "utils-mcp-"));
    const file = join(dir, "config.json");
    writeFileSync(file, '{"enabled":["desco"]}');
    expect(await loadConfig(file)).toEqual({ enabled: ["desco"] });
  });
});
