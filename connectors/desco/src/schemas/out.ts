import { z } from "@bixbd/utils-mcp-core";

// What the AI sees. Account and meter numbers are masked to the last 4 digits.
export const AccountsOut = z.object({
  accounts: z.array(
    z.object({
      accountId: z.number(),
      accountNoLast4: z.string().nullable(),
      meterNoLast4: z.string().nullable(),
      status: z.string().nullable(),
      linkStatus: z.string().nullable(),
    }),
  ),
});

export const BalanceOut = z.object({
  balance: z.number().nullable(),
  currency: z.string().nullable(),
  balanceSnapshotAt: z.string().nullable(),
  timestampAvailable: z.boolean(),
  stale: z.boolean(),
  currentMonthConsumedTaka: z.number().nullable(),
  readingTime: z.string().nullable(),
  consumerMessages: z.array(z.unknown()),
  note: z.string(),
});

export const RealtimeOut = z.object({
  enabled: z.boolean(),
  meters: z.array(
    z.object({
      accountId: z.number().nullable(),
      meterNoLast4: z.string().nullable(),
      meterType: z.string().nullable(),
      status: z.string().nullable(),
      message: z.string().nullable(),
      lastRealtimeBalance: z.number().nullable(),
      lastRealtimeReceivedAt: z.string().nullable(),
      nextEligibleAt: z.string().nullable(),
      attemptsToday: z.number().nullable(),
      remainingAttempts: z.number().nullable(),
    }),
  ),
});

/** Passthrough wrapper for endpoints whose shape we do not constrain. */
export const DataOut = z.object({ data: z.unknown() });
