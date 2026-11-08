import { envSecrets, type JsonSchema, type RuntimeContext } from "@bixbd/utils-mcp-core";

/** Every tool accepts an optional `account` label. The server adds it, so connectors don't have to. */
export function withAccountInput(schema: JsonSchema): JsonSchema {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      account: {
        type: "string",
        description: 'Account label to use. Defaults to "default".',
      },
    },
  };
}

export function splitAccount(args: Record<string, unknown>): {
  account: string;
  input: Record<string, unknown>;
} {
  const { account, ...input } = args;
  return {
    account: typeof account === "string" && account !== "" ? account : "default",
    input,
  };
}

export function buildContext(
  account: string,
  env: Record<string, string | undefined> = process.env,
): RuntimeContext {
  return { account, fetch, secrets: envSecrets(account, env) };
}
