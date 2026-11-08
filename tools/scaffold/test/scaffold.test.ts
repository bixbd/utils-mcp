import { describe, expect, test } from "bun:test";
import { checkConnectorFolder, type ConnectorFolder } from "../src/check";
import { renderConnector, toCamel, toEnvPrefix } from "../src/render";

const clean = (): ConnectorFolder => ({
  folder: "acme",
  packageName: "@bixbd/utils-mcp-connector-acme",
  files: ["README.md", "src/index.ts", "test/connector.test.ts"],
  sources: { "src/index.ts": "export default connector;" },
});

describe("renderConnector", () => {
  test("renders the standard files with the right names", () => {
    const files = renderConnector("acme-portal");
    expect(Object.keys(files).sort()).toEqual([
      "README.md",
      "fixtures/.gitkeep",
      "package.json",
      "src/index.ts",
      "test/connector.test.ts",
      "tsconfig.json",
    ]);
    expect(files["src/index.ts"]).toContain('id: "acme-portal"');
    expect(files["src/index.ts"]).toContain("export const acmePortal");
    expect(files["src/index.ts"]).toContain("ACME_PORTAL_API_KEY");
    expect(JSON.parse(files["package.json"] ?? "{}").name).toBe("@bixbd/utils-mcp-connector-acme-portal");
  });

  test("rejects names that are not kebab-case", () => {
    expect(() => renderConnector("Acme_Portal")).toThrow("Invalid connector name");
    expect(() => renderConnector("../x")).toThrow("Invalid connector name");
  });

  test("converts names", () => {
    expect(toCamel("a-b-c")).toBe("aBC");
    expect(toEnvPrefix("acme-portal")).toBe("ACME_PORTAL");
  });

  test("a freshly generated connector passes the repo checks", () => {
    const files = renderConnector("acme-portal");
    const sources = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith("src/")));
    const problems = checkConnectorFolder({
      folder: "acme-portal",
      packageName: JSON.parse(files["package.json"] ?? "{}").name,
      files: Object.keys(files),
      sources,
    });
    expect(problems).toEqual([]);
  });
});

describe("checkConnectorFolder", () => {
  test("passes a clean folder", () => {
    expect(checkConnectorFolder(clean())).toEqual([]);
  });

  test("flags a wrong package name, missing README and missing tests", () => {
    const info = { ...clean(), packageName: "wrong", files: ["src/index.ts"] };
    const problems = checkConnectorFolder(info).join("\n");
    expect(problems).toContain("package name");
    expect(problems).toContain("README.md");
    expect(problems).toContain("test");
  });

  test("flags direct fetch, process.env and cross-connector imports", () => {
    const info = clean();
    info.sources["src/bad.ts"] = [
      'import { x } from "@bixbd/utils-mcp-connector-other";',
      "const key = process.env.SECRET;",
      "await fetch('https://x.test');",
      "await ctx.fetch('https://x.test');",
    ].join("\n");
    const problems = checkConnectorFolder(info);
    expect(problems.filter((p) => p.includes("src/bad.ts"))).toHaveLength(3);
  });

  test("ignores the word fetch inside comments", () => {
    const info = clean();
    info.sources["src/ok.ts"] = "// we used to fetch(...) here\n/* fetch( */ const a = 1;";
    expect(checkConnectorFolder(info)).toEqual([]);
  });

  test("requires a default export", () => {
    const info = clean();
    info.sources["src/index.ts"] = "export const connector = {};";
    expect(checkConnectorFolder(info).join("\n")).toContain("default-export");
  });
});
