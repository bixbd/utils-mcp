import { defineConnector, defineTool, formLogin, maskLast4, UtilsError, z, type ToolContext } from "@bixbd/utils-mcp-core";
import { AccountsOut, BalanceOut, RawAccounts, RawBalance, RawRealtime, RealtimeOut } from "./schemas";

const listAccounts = async (ctx: ToolContext) => {
  const raw = await ctx.http.json("/accounts", RawAccounts);
  return raw.accounts.map((account) => ({
    accountId: account.accountId,
    accountNoLast4: maskLast4(account.accountNo),
    meterNoLast4: maskLast4(account.meterNo),
    status: account.status ?? null,
    linkStatus: account.linkStatus ?? null,
  }));
};

/** The only linked account, or an error that tells the AI what to do next. */
async function resolveAccountId(ctx: ToolContext): Promise<number> {
  const accounts = await listAccounts(ctx);
  const only = accounts[0];
  if (only === undefined) {
    throw new UtilsError(
      "NOT_FOUND",
      "No electricity account is linked to this DESCO login",
      "Link the account in the DESCO portal first, then try again.",
    );
  }
  if (accounts.length > 1) {
    const options = accounts.map((a) => `${a.accountId} (meter ending ${a.meterNoLast4 ?? "unknown"})`).join(", ");
    throw new UtilsError(
      "INVALID_INPUT",
      "Several accounts are linked, so accountId is required",
      `Call again with one of: ${options}.`,
    );
  }
  return only.accountId;
}

/**
 * DESCO prepaid electricity portal (https://prepaid.desco.org.bd/).
 * Unofficial. Flow follows KhBayazidAhmed/desco-prepaid-api: CSRF cookie, login,
 * session cookies, then /accounts and /accounts/{accountId}/balance.
 * Use only accounts you own or have permission to access.
 */
export const desco = defineConnector({
  id: "desco",
  version: "0.2.0",
  status: "beta",
  description: "DESCO prepaid electricity: linked accounts and balance (unofficial)",
  baseUrl: "https://prepaid.desco.org.bd/api",
  auth: formLogin({
    csrfPath: "/auth/csrf",
    loginPath: "/auth/login",
    secrets: { username: "DESCO_USERNAME", password: "DESCO_PASSWORD" },
  }),
  tools: [
    defineTool({
      name: "list_accounts",
      description:
        "List the DESCO prepaid accounts linked to the signed-in user, with account IDs. Use first when the user has not given an accountId.",
      access: "read",
      input: z.object({}),
      output: AccountsOut,
      handler: async (_input, ctx) => ({ accounts: await listAccounts(ctx) }),
    }),
    defineTool({
      name: "get_balance",
      description:
        "Get the daily prepaid electricity balance in BDT for a DESCO account. Use when asked about meter balance or remaining credit. Omit accountId if only one account is linked.",
      access: "read",
      input: z.object({
        accountId: z.number().int().positive().optional().describe("Internal accountId from list_accounts, not the account or meter number."),
      }),
      output: BalanceOut,
      handler: async (input, ctx) => {
        const accountId = input.accountId ?? (await resolveAccountId(ctx));
        const raw = await ctx.http.json(`/accounts/${accountId}/balance`, RawBalance);
        const balance = raw.balance ?? null;
        const timestampAvailable = raw.timestampAvailable !== false;
        const unavailable = balance === null || !timestampAvailable;
        return {
          balance,
          currency: raw.currency ?? null,
          balanceSnapshotAt: raw.balanceSnapshotAt ?? null,
          timestampAvailable,
          stale: raw.stale === true,
          currentMonthConsumedTaka: raw.currentMonthConsumedTaka ?? null,
          readingTime: raw.readingTime ?? null,
          consumerMessages: raw.consumerMessages ?? [],
          note: unavailable
            ? "The balance is unavailable right now. Do not treat it as zero."
            : "This is a daily snapshot, not a live meter reading. A recent recharge may not appear until the next update.",
        };
      },
    }),
    defineTool({
      name: "get_realtime_status",
      description:
        "Read the last realtime-reading result and whether a new reading is allowed, per meter. Use to explain realtime limits. It does not request a new reading.",
      access: "read",
      input: z.object({}),
      output: RealtimeOut,
      handler: async (_input, ctx) => {
        const raw = await ctx.http.json("/accounts/realtime-balance", RawRealtime);
        return {
          enabled: raw.enabled === true,
          meters: raw.meters.map((meter) => ({
            accountId: meter.accountId ?? null,
            meterNoLast4: maskLast4(meter.meterNo),
            meterType: meter.meterType ?? null,
            status: meter.status ?? null,
            message: meter.message ?? null,
            lastRealtimeBalance: meter.lastRealtimeBalance ?? null,
            lastRealtimeReceivedAt: meter.lastRealtimeReceivedAt ?? null,
            nextEligibleAt: meter.nextEligibleAt ?? null,
            attemptsToday: meter.attemptsToday ?? null,
            remainingAttempts: meter.remainingAttempts ?? null,
          })),
        };
      },
    }),
  ],
});

export default desco;
