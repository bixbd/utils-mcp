import { describe, expect, test } from "bun:test";
import { validateCommitMessage } from "../src/commit-msg";
import { scanForSecrets } from "../src/secrets";

describe("validateCommitMessage", () => {
  test("accepts conventional commits with and without scope", () => {
    expect(validateCommitMessage("feat(desco): add realtime status")).toEqual([]);
    expect(validateCommitMessage("fix: handle expired session")).toEqual([]);
    expect(validateCommitMessage("refactor(core)!: rename http helper\n\nBREAKING CHANGE: renamed")).toEqual([]);
  });

  test("accepts trailers after a blank line", () => {
    const message = "chore: tidy\n\nBody text.\n\nCo-Authored-By: Someone <a@b.c>";
    expect(validateCommitMessage(message)).toEqual([]);
  });

  test("rejects free-form subjects", () => {
    expect(validateCommitMessage("Added some stuff")).toHaveLength(1);
    expect(validateCommitMessage("feature: nope")[0]).toContain("type");
    expect(validateCommitMessage("feat:missing space")).toHaveLength(1);
  });

  test("rejects long subjects, trailing periods and missing blank line", () => {
    expect(validateCommitMessage(`feat: ${"x".repeat(80)}`).join(" ")).toContain("72");
    expect(validateCommitMessage("fix: done.").join(" ")).toContain("period");
    expect(validateCommitMessage("fix: ok\nbody right away").join(" ")).toContain("blank line");
  });

  test("ignores git comment lines and allows merge and revert commits", () => {
    expect(validateCommitMessage("fix: ok\n# Please enter the commit message")).toEqual([]);
    expect(validateCommitMessage("Merge branch 'main' into feat/x")).toEqual([]);
    expect(validateCommitMessage('Revert "feat: x"')).toEqual([]);
  });
});

describe("scanForSecrets", () => {
  const scan = (path: string, content: string) => scanForSecrets([{ path, content }]);
  const fake = (prefix: string, length: number) => prefix + "a".repeat(length);

  test("passes ordinary code", () => {
    expect(scan("src/a.ts", "const x = 1;\nexport const name = 'desco';")).toEqual([]);
  });

  test("finds provider tokens and private keys", () => {
    expect(scan("src/a.ts", `const t = "${fake("ghp_", 36)}";`)[0]?.reason).toBe("GitHub token");
    expect(scan("src/a.ts", `key AKIA${"A".repeat(16)}`)[0]?.reason).toBe("AWS access key id");
    expect(scan("src/a.ts", "-----BEGIN RSA PRIVATE KEY-----")[0]?.reason).toBe("private key block");
    expect(scan("src/a.ts", `const k = "${fake("sk-ant-", 30)}";`)[0]?.reason).toBe("Anthropic API key");
  });

  test("reports the line number", () => {
    expect(scan("src/a.ts", `ok\nconst t = "${fake("npm_", 36)}";`)[0]?.line).toBe(2);
  });

  test("flags hard-coded credential assignments in source, not in tests or fixtures", () => {
    const line = 'const password = "hunter2-secret";';
    expect(scan("src/a.ts", line)[0]?.reason).toBe("hard-coded credential assignment");
    expect(scan("connectors/x/test/a.test.ts", line)).toEqual([]);
    expect(scan("connectors/x/fixtures/a.json", line)).toEqual([]);
  });

  test("does not flag reading a secret from the environment", () => {
    expect(scan("src/a.ts", 'const password = ctx.secrets.get("DESCO_PASSWORD");')).toEqual([]);
  });

  test("blocks env files, keys, HAR captures, cookie jars and session databases", () => {
    for (const path of [".env", ".env.local", "certs/server.pem", "capture.har", "cookies.txt", "sessions.sqlite"]) {
      expect(scan(path, "")).toHaveLength(1);
    }
  });

  test("allows .env.example", () => {
    expect(scan(".env.example", "DESCO_USERNAME=")).toEqual([]);
  });

  test("honors an inline allow marker", () => {
    expect(scan("src/a.ts", `const t = "${fake("ghp_", 36)}"; // guard:allow-secret`)).toEqual([]);
  });
});
