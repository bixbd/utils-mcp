import { z } from "@bixbd/utils-mcp-core";

// Upstream shapes: only the fields we depend on. See KhBayazidAhmed/desco-prepaid-api.
export const RawAccounts = z.object({
  accounts: z.array(
    z.object({
      accountId: z.number(),
      accountNo: z.string().nullish(),
      meterNo: z.string().nullish(),
      status: z.string().nullish(),
      linkStatus: z.string().nullish(),
    }),
  ),
});

export const RawBalance = z.object({
  balance: z.number().nullish(),
  currency: z.string().nullish(),
  balanceSnapshotAt: z.string().nullish(),
  timestampAvailable: z.boolean().optional(),
  stale: z.boolean().optional(),
  currentMonthConsumedTaka: z.number().nullish(),
  readingTime: z.string().nullish(),
  consumerMessages: z.array(z.unknown()).optional(),
});

export const RawRealtime = z.object({
  enabled: z.boolean().optional(),
  meters: z.array(
    z.object({
      accountId: z.number().nullish(),
      meterNo: z.string().nullish(),
      meterType: z.string().nullish(),
      status: z.string().nullish(),
      message: z.string().nullish(),
      lastRealtimeBalance: z.number().nullish(),
      lastRealtimeReceivedAt: z.string().nullish(),
      nextEligibleAt: z.string().nullish(),
      attemptsToday: z.number().nullish(),
      remainingAttempts: z.number().nullish(),
    }),
  ),
});

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
