import { describe, expect, test } from "bun:test";
import { bundledIds, resolveEnabled } from "../src/enabled";

describe("resolveEnabled", () => {
  test("env wins over config", () => {
    expect(resolveEnabled(["a"], { UTILS_MCP_ENABLED: "x, y" })).toEqual(["x", "y"]);
  });
  test("config wins over the default", () => {
    expect(resolveEnabled(["a"], {})).toEqual(["a"]);
  });
  test("defaults to bundled connectors", () => {
    expect(resolveEnabled([], {})).toEqual(bundledIds());
    expect(bundledIds()).toContain("desco");
  });
});
