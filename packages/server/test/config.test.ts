import { describe, expect, test } from "bun:test";
import { configPath, DEFAULT_CONFIG, parseConfig } from "../src/config";

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
});
