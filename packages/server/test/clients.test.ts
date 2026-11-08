import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isInstalled, jsonClients, launchCommand, mergeServer } from "../src/clients";

const entry = { command: "npx", args: ["-y", "@bixbd/utils-mcp"], env: { A: "1" } };

describe("mergeServer", () => {
  test("creates a config from nothing", () => {
    expect(JSON.parse(mergeServer(undefined, "mcpServers", entry))).toEqual({ mcpServers: { utils: entry } });
  });
  test("keeps other servers and settings", () => {
    const existing = JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x" } } });
    const merged = JSON.parse(mergeServer(existing, "mcpServers", entry));
    expect(merged.theme).toBe("dark");
    expect(merged.mcpServers.other).toEqual({ command: "x" });
    expect(merged.mcpServers.utils).toEqual(entry);
  });
  test("refuses to overwrite a file it cannot parse", () => {
    expect(() => mergeServer("{ nope", "mcpServers", entry)).toThrow("not valid JSON");
  });
});

const find = (p: NodeJS.Platform) => jsonClients(p, "/h", "/a").find((c) => c.name === "Claude Desktop")?.file;

describe("jsonClients", () => {
  test("uses each platform's Claude Desktop path", () => {
    expect(find("darwin")).toContain("Library/Application Support/Claude");
    expect(find("win32")).toContain("Claude");
    expect(find("linux")).toContain(".config/Claude");
  });
});

describe("launchCommand", () => {
  test("prefers the npx next to the running node", () => {
    const dir = mkdtempSync(join(tmpdir(), "utils-mcp-"));
    writeFileSync(join(dir, "npx"), "");
    const launch = launchCommand("linux", join(dir, "node"));
    expect(launch.command).toBe(join(dir, "npx"));
    expect(launch.args).toEqual(["-y", "@bixbd/utils-mcp"]);
  });
  test("falls back to npx on the PATH", () => {
    expect(launchCommand("linux", "/nowhere/node").command).toBe("npx");
  });
});

describe("isInstalled", () => {
  test("is true when the app's config folder exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "utils-mcp-"));
    expect(isInstalled({ name: "x", file: join(dir, "c.json"), key: "mcpServers" })).toBe(true);
    expect(isInstalled({ name: "x", file: join(dir, "missing", "c.json"), key: "mcpServers" })).toBe(false);
  });
});
