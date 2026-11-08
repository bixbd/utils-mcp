export type ScannedFile = { path: string; content: string };
export type Finding = { path: string; line: number | undefined; reason: string };

const ALLOW = "guard:allow-secret";

const CONTENT_RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "private key block", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { reason: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { reason: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { reason: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { reason: "npm token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { reason: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { reason: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { reason: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
];

// Hard-coded credential assignments. Skipped in tests and fixtures, where fake values are expected.
const ASSIGNMENT = /\b(?:password|passwd|secret|api[_-]?key|token)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i;

const FORBIDDEN_FILES: { reason: string; pattern: RegExp }[] = [
  { reason: "environment file", pattern: /(^|\/)\.env(\.(?!example$)|$)/ },
  { reason: "private key or certificate file", pattern: /\.(pem|key|p12|pfx)$/ },
  { reason: "browser capture (may contain cookies and tokens)", pattern: /\.har$/ },
  { reason: "cookie jar", pattern: /(^|\/)cookies?(\.txt|\.json)?$/ },
  { reason: "session database", pattern: /\.(sqlite|sqlite3|db)$/ },
];

const isTestOrFixture = (path: string) => /(^|\/)(test|tests|fixtures)\//.test(path) || path.endsWith(".test.ts");

export function scanForSecrets(files: ScannedFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    for (const rule of FORBIDDEN_FILES) {
      if (rule.pattern.test(file.path)) {
        findings.push({ path: file.path, line: undefined, reason: rule.reason });
      }
    }
    const skipAssignments = isTestOrFixture(file.path);
    file.content.split("\n").forEach((text, index) => {
      if (text.includes(ALLOW)) {
        return;
      }
      for (const rule of CONTENT_RULES) {
        if (rule.pattern.test(text)) {
          findings.push({ path: file.path, line: index + 1, reason: rule.reason });
        }
      }
      if (!skipAssignments && ASSIGNMENT.test(text)) {
        findings.push({ path: file.path, line: index + 1, reason: "hard-coded credential assignment" });
      }
    });
  }
  return findings;
}
