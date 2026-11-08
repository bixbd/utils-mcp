import { UtilsError, type Connector } from "@bixbd/utils-mcp-core";
import { getJson } from "./client";
import { parseAccounts, parseBalance, parseRealtime } from "./parse";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

/**
 * DESCO prepaid electricity portal (https://prepaid.desco.org.bd/).
 * Unofficial. Flow follows KhBayazidAhmed/desco-prepaid-api: CSRF cookie, login,
 * session cookies, then /accounts and /accounts/{accountId}/balance.
 * Use only accounts you own or have permission to access.
 */
export const desco: Connector = {
  id: "desco",
  version: "0.1.0",
  status: "beta",
  description: "DESCO prepaid electricity: linked accounts and balance (unofficial)",
  auth: ["form-login"],
  tools: [
    {
      name: "list_accounts",
      description:
        "List the DESCO prepaid accounts linked to the signed-in user, with account IDs. Use first when the user has not given an accountId.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: READ_ONLY,
      handler: async (_input, ctx) => ({ accounts: parseAccounts(await getJson(ctx, "/accounts")) }),
    },
    {
      name: "get_balance",
      description:
        "Get the daily prepaid electricity balance in BDT for a DESCO account. Use when asked about meter balance or remaining credit. Omit accountId if only one account is linked.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: {
            type: "integer",
            description: "Internal accountId from list_accounts (not the account or meter number).",
          },
        },
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      handler: async (input, ctx) => {
        let accountId = input.accountId;
        if (accountId === undefined) {
          const accounts = parseAccounts(await getJson(ctx, "/accounts"));
          const only = accounts.length === 1 ? accounts[0] : undefined;
          if (accounts.length === 0) {
            throw new UtilsError(
              "NOT_FOUND",
              "No electricity account is linked to this DESCO login",
              "Link the account in the DESCO portal first, then try again.",
            );
          }
          if (only === undefined) {
            const options = accounts
              .map((a) => `${a.accountId} (meter ending ${a.meterNoLast4 ?? "unknown"})`)
              .join(", ");
            throw new UtilsError(
              "INVALID_INPUT",
              "Several accounts are linked, so accountId is required",
              `Call again with one of: ${options}.`,
            );
          }
          accountId = only.accountId;
        }
        if (typeof accountId !== "number" || accountId <= 0) {
          throw new UtilsError("INVALID_INPUT", "accountId must be a positive integer", "Use an ID from list_accounts.");
        }
        return parseBalance(await getJson(ctx, `/accounts/${accountId}/balance`));
      },
    },
    {
      name: "get_realtime_status",
      description:
        "Read the last realtime-reading result and whether a new reading is allowed, per meter. Use to explain realtime limits. It does not request a new reading.",
      inputSchema: { type: "object", additionalProperties: false },
      annotations: READ_ONLY,
      handler: async (_input, ctx) => parseRealtime(await getJson(ctx, "/accounts/realtime-balance")),
    },
  ],
};
