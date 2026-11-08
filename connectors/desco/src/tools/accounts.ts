import { defineTool, maskLast4, z } from "@bixbd/utils-mcp-core";
import { listAccounts, resolveAccountId } from "../client";
import { AccountsOut, BalanceOut, RawBalance, RawRealtime, RealtimeOut } from "../schemas";
import { accountIdInput } from "./factories";

const listAccountsTool = defineTool({
  name: "list_accounts",
  description:
    "List the DESCO prepaid accounts linked to the signed-in user, with account IDs. Use first when the user has not given an accountId.",
  access: "read",
  input: z.object({}),
  output: AccountsOut,
  handler: async (_input, ctx) => ({ accounts: await listAccounts(ctx) }),
});

const getBalance = defineTool({
  name: "get_balance",
  description:
    "Get the daily prepaid electricity balance in BDT for a DESCO account. Use when asked about meter balance or remaining credit. Omit accountId if only one account is linked.",
  access: "read",
  input: z.object({ accountId: accountIdInput }),
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
});

const getRealtimeStatus = defineTool({
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
});

/** Core account tools: who is linked, how much credit, realtime limits. */
export const accountTools = [listAccountsTool, getBalance, getRealtimeStatus];
