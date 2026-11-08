#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { validateCommitMessage } from "./commit-msg";
import { scanForSecrets, type ScannedFile } from "./secrets";

const err = (message: string) => process.stderr.write(`${message}\n`);
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function stagedFiles(): ScannedFile[] {
  const paths = git("diff", "--cached", "--name-only", "--diff-filter=ACM").split("\n").filter(Boolean);
  return paths.map((path) => ({ path, content: git("show", `:${path}`) }));
}

function secrets() {
  const findings = scanForSecrets(stagedFiles());
  if (findings.length === 0) {
    return;
  }
  err("Possible secrets in staged changes:");
  for (const f of findings) {
    err(`  ${f.path}${f.line === undefined ? "" : `:${f.line}`}  ${f.reason}`);
  }
  err('If a finding is a false positive, add "guard:allow-secret" on that line. Never commit real credentials.');
  process.exit(1);
}

function failOn(problems: string[], context: string) {
  if (problems.length === 0) {
    return;
  }
  err(context);
  for (const problem of problems) {
    err(`  - ${problem}`);
  }
  err("Format: type(scope): summary   e.g. feat(desco): add realtime status");
  process.exit(1);
}

function commitMsg(file: string | undefined) {
  if (file === undefined) {
    err("Usage: cli.ts commit-msg <message-file>");
    process.exit(1);
  }
  failOn(validateCommitMessage(readFileSync(file, "utf8")), "Invalid commit message:");
}

/** Checks every commit message in a range, for CI. */
function commits(range: string | undefined) {
  if (range === undefined) {
    err("Usage: cli.ts commits <base>..<head>");
    process.exit(1);
  }
  const problems = git("log", "--format=%H%x00%B%x01", range)
    .split("\u0001")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [hash = "", message = ""] = entry.split("\u0000");
      return validateCommitMessage(message).map((problem) => `${hash.slice(0, 7)}: ${problem}`);
    });
  failOn(problems, "Commits that do not follow Conventional Commits:");
}

const [command, argument] = process.argv.slice(2);
if (command === "secrets") {
  secrets();
} else if (command === "commit-msg") {
  commitMsg(argument);
} else if (command === "commits") {
  commits(argument);
} else {
  err("Usage: cli.ts secrets | commit-msg <file> | commits <base>..<head>");
  process.exit(1);
}
