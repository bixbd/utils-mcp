import { UtilsError } from "@bixbd/utils-mcp-core";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Last four characters only. The AI doesn't need full account or meter numbers. */
export const last4 = (value: unknown): string | null =>
  typeof value === "string" && value.length >= 4 ? value.slice(-4) : null;

export function drift(what: string): UtilsError {
  return new UtilsError(
    "UPSTREAM_CHANGED",
    `DESCO ${what} no longer has the expected shape`,
    "The portal changed its format. Update the connector parser and fixtures.",
  );
}

export type LinkedAccount = {
  accountId: number;
  accountNoLast4: string | null;
  meterNoLast4: string | null;
  status: string | null;
  linkStatus: string | null;
};

export function parseAccounts(body: unknown): LinkedAccount[] {
  if (!isRecord(body) || !Array.isArray(body.accounts)) {
    throw drift("account list");
  }
  return body.accounts.map((item: unknown) => {
    if (!isRecord(item) || typeof item.accountId !== "number") {
      throw drift("account entry");
    }
    return {
      accountId: item.accountId,
      accountNoLast4: last4(item.accountNo),
      meterNoLast4: last4(item.meterNo),
      status: typeof item.status === "string" ? item.status : null,
      linkStatus: typeof item.linkStatus === "string" ? item.linkStatus : null,
    };
  });
}

export function parseBalance(body: unknown) {
  if (!isRecord(body)) {
    throw drift("balance response");
  }
  const balance = typeof body.balance === "number" ? body.balance : null;
  const timestampAvailable = body.timestampAvailable !== false;
  const result: Record<string, unknown> = {
    balance,
    currency: typeof body.currency === "string" ? body.currency : null,
    balanceSnapshotAt: typeof body.balanceSnapshotAt === "string" ? body.balanceSnapshotAt : null,
    timestampAvailable,
    stale: body.stale === true,
    currentMonthConsumedTaka:
      typeof body.currentMonthConsumedTaka === "number" ? body.currentMonthConsumedTaka : null,
    readingTime: typeof body.readingTime === "string" ? body.readingTime : null,
    consumerMessages: Array.isArray(body.consumerMessages) ? body.consumerMessages : [],
    note: "This is a daily snapshot, not a live meter reading. A recent recharge may not appear until the next update.",
  };
  if (balance === null || !timestampAvailable) {
    result.note = "The balance is unavailable right now. Do not treat it as zero.";
  }
  return result;
}

export function parseRealtime(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.meters)) {
    throw drift("realtime balance status");
  }
  return {
    enabled: body.enabled === true,
    meters: body.meters.map((meter: unknown) => {
      if (!isRecord(meter)) {
        throw drift("realtime meter entry");
      }
      return {
        accountId: typeof meter.accountId === "number" ? meter.accountId : null,
        meterNoLast4: last4(meter.meterNo),
        meterType: typeof meter.meterType === "string" ? meter.meterType : null,
        status: typeof meter.status === "string" ? meter.status : null,
        message: typeof meter.message === "string" ? meter.message : null,
        lastRealtimeBalance:
          typeof meter.lastRealtimeBalance === "number" ? meter.lastRealtimeBalance : null,
        lastRealtimeReceivedAt:
          typeof meter.lastRealtimeReceivedAt === "string" ? meter.lastRealtimeReceivedAt : null,
        nextEligibleAt: typeof meter.nextEligibleAt === "string" ? meter.nextEligibleAt : null,
        attemptsToday: typeof meter.attemptsToday === "number" ? meter.attemptsToday : null,
        remainingAttempts:
          typeof meter.remainingAttempts === "number" ? meter.remainingAttempts : null,
      };
    }),
  };
}
