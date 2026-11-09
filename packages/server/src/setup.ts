import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { isInstalled, jsonClients, launchCommand, mergeServer, type Entry } from "./clients";

type Field = { env: string; label: string; secret?: boolean };
type Service = { id: string; name: string; fields: Field[] };

const SERVICES: Service[] = [
  { id: "nesco", name: "NESCO prepaid electricity (Bangladesh)", fields: [
    { env: "NESCO_METER_ID", label: "NESCO customer or meter number (8–11 digits)" },
  ] },
  { id: "rapidpass", name: "RapidPass smart card (Bangladesh transit)", fields: [
    { env: "RAPIDPASS_COOKIES", label: "Cookie header from a logged-in browser (safest)", secret: true },
    { env: "RAPIDPASS_EMAIL", label: "RapidPass email or mobile number" },
    { env: "RAPIDPASS_PASSWORD", label: "RapidPass password", secret: true },
  ] },
  {
    id: "desco",
    name: "DESCO prepaid electricity (Bangladesh)",
    fields: [
      { env: "DESCO_USERNAME", label: "DESCO portal username" },
      { env: "DESCO_PASSWORD", label: "DESCO portal password", secret: true },
    ],
  },
];

const out = (text = "") => process.stdout.write(`${text}\n`);

type Prompt = { label: string; secret: boolean; save: (value: string) => void };

/** Reads typed lines one at a time. While `muted`, typed characters are not echoed. */
function makeReader() {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk);
      }
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY === true });
  // An iterator buffers lines, so piped input and fast typists lose nothing.
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (label: string, secret: boolean) => {
    process.stdout.write(label);
    muted = secret;
    const next = await lines.next();
    muted = false;
    if (secret) {
      process.stdout.write("\n");
    }
    return next.done === true ? "" : next.value.trim();
  };
  return { ask, close: () => rl.close() };
}

/** Asks the prompts in order. Each answer may add more prompts, which is why this recurses. */
async function askInOrder(ask: (label: string, secret: boolean) => Promise<string>, prompts: Prompt[]): Promise<void> {
  const [first, ...rest] = prompts;
  if (first === undefined) {
    return;
  }
  first.save(await ask(first.label, first.secret));
  await askInOrder(ask, rest);
}

export async function runSetup(): Promise<void> {
  const reader = makeReader();
  try {
    out("utils-mcp setup: connect your utility accounts to your AI app.\n");

    const env: Record<string, string> = {};
    const chosen: string[] = [];
    await askInOrder(
      reader.ask,
      SERVICES.map((service) => ({
        label: `Use ${service.name}? [Y/n] `,
        secret: false,
        save: (answer: string) => {
          if (!["n", "no"].includes(answer.toLowerCase())) {
            chosen.push(service.id);
          }
        },
      })),
    );
    const fields = SERVICES.filter((s) => chosen.includes(s.id)).flatMap((s) => s.fields);
    await askInOrder(
      reader.ask,
      fields.map((field) => ({
        label: `  ${field.label}: `,
        secret: field.secret === true,
        save: (value: string) => {
          if (value) {
            env[field.env] = value;
          }
        },
      })),
    );
    if (chosen.length === 0) {
      out("Nothing selected. Run setup again when you are ready.");
      return;
    }
    env.UTILS_MCP_ENABLED = chosen.join(",");
    const entry: Entry = { ...launchCommand(), env };

    const done: string[] = [];
    for (const client of jsonClients().filter(isInstalled)) {
      try {
        let existing: string | undefined;
        try {
          existing = readFileSync(client.file, "utf8");
        } catch {
          existing = undefined;
        }
        mkdirSync(dirname(client.file), { recursive: true });
        writeFileSync(client.file, mergeServer(existing, client.key, entry), { mode: 0o600 });
        done.push(client.name);
      } catch (error) {
        out(`! ${client.name}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }

    // Claude Code keeps its own list; use its CLI when present.
    const claude = spawnSync("claude", ["--version"], { stdio: "ignore" });
    if (claude.status === 0) {
      const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
      const added = spawnSync(
        "claude",
        ["mcp", "add", "--scope", "user", "utils", ...envArgs, "--", entry.command, ...entry.args],
        { stdio: "ignore" },
      );
      if (added.status === 0) {
        done.push("Claude Code");
      }
    }

    out("");
    if (done.length > 0) {
      out(`Done. Configured: ${done.join(", ")}.`);
      out("Restart your AI app, then ask something like: \"What is my DESCO balance?\"");
    } else {
      out("No supported AI app found. Add this to your app's MCP settings (the name 'utils' is your choice):\n");
      out(JSON.stringify({ mcpServers: { utils: entry } }, null, 2));
    }
    out("\nYour password is stored only in your AI app's own config file on this computer.");
  } finally {
    reader.close();
  }
}
