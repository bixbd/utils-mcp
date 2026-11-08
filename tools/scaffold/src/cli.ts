#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { checkConnectorFolder } from "./check";
import { renderConnector } from "./render";

const root = join(import.meta.dir, "..", "..", "..");
const connectorsDir = join(root, "connectors");
const out = (message: string) => process.stdout.write(`${message}\n`);
const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  return process.exit(1);
};

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules") {
      return [];
    }
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function create(name: string | undefined) {
  if (name === undefined) {
    fail("Usage: bun run new:connector <name>   (lowercase kebab-case, for example acme-portal)");
    return;
  }
  const target = join(connectorsDir, name);
  if (existsSync(target)) {
    fail(`connectors/${name} already exists.`);
  }
  let files: Record<string, string> = {};
  try {
    files = renderConnector(name);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Could not render the connector.");
  }
  for (const [path, content] of Object.entries(files)) {
    const full = join(target, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  out(`Created connectors/${name}`);
  out("Next: bun install, edit src/index.ts, save real responses in fixtures/, then bun run test && bun run check:connectors");
}

function check() {
  const problems: string[] = [];
  for (const folder of readdirSync(connectorsDir)) {
    const dir = join(connectorsDir, folder);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    const files = listFiles(dir).map((file) => relative(dir, file));
    const packagePath = join(dir, "package.json");
    const packageName = existsSync(packagePath)
      ? (JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string }).name
      : undefined;
    const sources: Record<string, string> = {};
    for (const file of files.filter((f) => f.startsWith("src/") && f.endsWith(".ts"))) {
      sources[file] = readFileSync(join(dir, file), "utf8");
    }
    problems.push(...checkConnectorFolder({ folder, packageName, files, sources }));
  }
  if (problems.length > 0) {
    fail(problems.join("\n"));
  }
  out("All connectors pass the repo checks.");
}

const [command, argument] = process.argv.slice(2);
if (command === "new") {
  create(argument);
} else if (command === "check") {
  check();
} else {
  fail("Usage: cli.ts new <name> | check");
}
