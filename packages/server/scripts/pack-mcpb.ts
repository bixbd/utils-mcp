/**
 * Builds the Claude Desktop extension: bun scripts/pack-mcpb.ts [version]
 * Output: dist/utils-mcp.mcpb. The version defaults to this package's version.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const run = (cmd: string, args: string[], cwd = root) => {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
};

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
const version = (process.argv[2] ?? pkg.version).replace(/^v/, "");
const stage = join(root, ".mcpb-build");

run("bun", ["run", "build"]);
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "server"), { recursive: true });
cpSync(join(root, "dist", "cli.js"), join(stage, "server", "index.js"));
const manifest = JSON.parse(readFileSync(join(root, "mcpb", "manifest.json"), "utf8")) as Record<string, unknown>;
writeFileSync(join(stage, "manifest.json"), `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);

const output = join(root, "dist", "utils-mcp.mcpb");
run("npx", ["-y", "@anthropic-ai/mcpb@2.1.2", "pack", stage, output]);
rmSync(stage, { recursive: true, force: true });
process.stdout.write(`\nBuilt ${output}\n`);
