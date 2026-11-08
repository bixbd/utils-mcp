import { maskLast4, UtilsError, type ToolContext } from "@bixbd/utils-mcp-core";
import { RawAccounts } from "../schemas";

export async function listAccounts(ctx: ToolContext) {
  const raw = await ctx.http.json("/accounts", RawAccounts);
  return raw.accounts.map((account) => ({
    accountId: account.accountId,
    accountNoLast4: maskLast4(account.accountNo),
    meterNoLast4: maskLast4(account.meterNo),
    status: account.status ?? null,
    linkStatus: account.linkStatus ?? null,
  }));
}

/** The only linked account, or an error that tells the AI what to do next. */
export async function resolveAccountId(ctx: ToolContext): Promise<number> {
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
