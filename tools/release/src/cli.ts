#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { distTag, publishOrder, versionFromTag, type Pkg } from "./plan";

const ROOTS = ["packages", "connectors"];

function readPackages(): Pkg[] {
  return ROOTS.flatMap((root) =>
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = join(root, entry.name);
        const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<string, unknown>;
        const deps = { ...(json.dependencies as object), ...(json.devDependencies as object) };
        return {
          name: String(json.name),
          dir,
          version: String(json.version),
          private: json.private === true,
          dependsOn: Object.keys(deps),
        };
      }),
  );
}

function setVersion(dir: string, version: string) {
  const file = join(dir, "package.json");
  const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

const [command, tag] = process.argv.slice(2);
if (command === undefined || tag === undefined) {
  process.stderr.write("Usage: cli.ts order|dist-tag|set-version <tag>\n");
  process.exit(1);
}
const version = versionFromTag(tag);
if (command === "order") {
  process.stdout.write(`${publishOrder(readPackages()).map((p) => p.dir).join("\n")}\n`);
} else if (command === "dist-tag") {
  process.stdout.write(`${distTag(version)}\n`);
} else if (command === "set-version") {
  for (const p of publishOrder(readPackages())) {
    setVersion(p.dir, version);
  }
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.exit(1);
}
