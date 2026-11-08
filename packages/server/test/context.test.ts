import { describe, expect, test } from "bun:test";
import { buildContext, splitAccount, withAccountInput } from "../src/context";

describe("context", () => {
  test("adds an optional account input without touching the original schema", () => {
    const original = { type: "object" as const, properties: { id: { type: "integer" as const } } };
    const schema = withAccountInput(original);
    expect(Object.keys(schema.properties ?? {})).toEqual(["id", "account"]);
    expect(schema.required).toBeUndefined();
    expect(Object.keys(original.properties)).toEqual(["id"]);
  });

  test("splits the account label from tool input", () => {
    expect(splitAccount({ account: "office", id: 1 })).toEqual({ account: "office", input: { id: 1 } });
    expect(splitAccount({ id: 1 })).toEqual({ account: "default", input: { id: 1 } });
    expect(splitAccount({ account: "" }).account).toBe("default");
  });

  test("builds a context whose secrets come from the account's env names", () => {
    const ctx = buildContext("office", { DESCO_USERNAME__OFFICE: "u" });
    expect(ctx.account).toBe("office");
    expect(ctx.secrets.get("DESCO_USERNAME")).toBe("u");
  });
});
