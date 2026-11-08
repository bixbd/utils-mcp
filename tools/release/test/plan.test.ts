import { describe, expect, test } from "bun:test";
import { distTag, publishOrder, versionFromTag, type Pkg } from "../src/plan";

const pkg = (name: string, dependsOn: string[] = [], isPrivate = false): Pkg => ({
  name,
  dir: name,
  version: "0.0.0",
  private: isPrivate,
  dependsOn,
});

describe("versionFromTag", () => {
  test("strips the v prefix", () => {
    expect(versionFromTag("v1.2.3")).toBe("1.2.3");
    expect(versionFromTag("0.1.0-beta.1")).toBe("0.1.0-beta.1");
  });

  test("rejects non-semver tags", () => {
    expect(() => versionFromTag("release-5")).toThrow("semver");
    expect(() => versionFromTag("v1.2")).toThrow("semver");
  });
});

describe("distTag", () => {
  test("prereleases never become latest", () => {
    expect(distTag("1.0.0")).toBe("latest");
    expect(distTag("1.0.0-rc.1")).toBe("next");
  });
});

describe("publishOrder", () => {
  test("publishes dependencies first and skips private packages", () => {
    const order = publishOrder([pkg("server", ["core", "desco"]), pkg("desco", ["core", "testkit"]), pkg("core"), pkg("testkit", ["core"], true)]);
    expect(order.map((p) => p.name)).toEqual(["core", "desco", "server"]);
  });

  test("detects cycles", () => {
    expect(() => publishOrder([pkg("a", ["b"]), pkg("b", ["a"])])).toThrow("cycle");
  });
});
