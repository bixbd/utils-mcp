export type ConnectorFolder = {
  /** Folder name under connectors/, for example "desco". */
  folder: string;
  /** The "name" in its package.json, if any. */
  packageName: string | undefined;
  /** Paths relative to the connector folder. */
  files: string[];
  /** Contents of files under src/, keyed by relative path. */
  sources: Record<string, string>;
};

const stripComments = (code: string) => code.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");

/** Repo rules that lint can't express. Returns violations; empty means the folder passes. */
export function checkConnectorFolder(info: ConnectorFolder): string[] {
  const problems: string[] = [];
  const at = (message: string) => problems.push(`connectors/${info.folder}: ${message}`);

  const expected = `@bixbd/utils-mcp-connector-${info.folder}`;
  if (info.packageName !== expected) {
    at(`package name must be ${expected} (found ${info.packageName ?? "none"})`);
  }
  if (!info.files.includes("README.md")) {
    at("missing README.md (what it is, tools, credentials)");
  }
  if (!info.files.includes("src/index.ts")) {
    at("missing src/index.ts");
  }
  if (!info.files.some((file) => /^test\/.+\.test\.ts$/.test(file))) {
    at("missing a test file in test/");
  }

  for (const [file, raw] of Object.entries(info.sources)) {
    const code = stripComments(raw);
    if (/\bfetch\s*\(/.test(code)) {
      at(`${file}: call the portal with ctx.http.json, not fetch`);
    }
    if (/process\.env/.test(code)) {
      at(`${file}: read credentials through ctx.secrets or an auth strategy, not process.env`);
    }
    if (/from\s+["']@bixbd\/utils-mcp-connector-/.test(code)) {
      at(`${file}: connectors must not import other connectors`);
    }
  }
  const index = info.sources["src/index.ts"];
  if (index !== undefined && !/export\s+default\s/.test(stripComments(index))) {
    at("src/index.ts must default-export the connector (the server loads it that way)");
  }
  return problems;
}
