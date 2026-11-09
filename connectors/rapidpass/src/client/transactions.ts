import { load } from "cheerio";
import type { ToolContext } from "@bixbd/utils-mcp-core";
import { changedPage, isEmailGate, isLoginPage, rejectedCredentials, unverifiedEmail } from "./gates";
import { sanitize } from "../text";

/** The "Payment ID" column is the recharge table's unique anchor. */
const PAYMENT_COLUMN = /Payment ID/i;

/** Reads one table in columns/rows shape, keeping rows the length of the headers. */
function readTable(html: string, anchor: RegExp): { columns: string[]; rows: string[][] } | null {
  const $ = load(html);
  const table = $("table").first();
  const headers = table.find("th").toArray();

  const anchored = table.length > 0 && headers.some((th) => anchor.test($(th).text()));
  if (!anchored) {
    return null;
  }
  const columns = headers.map((th) => sanitize($(th).text()));
  const rows = table.find("tbody tr")
    .toArray()
    .map((tr) => $(tr).find("td").toArray().map((td) => sanitize($(td).text())))
    .filter((row) => row.length > 0);

  return { columns, rows };
}

/**
 * Portal top-up payments: a plain table with an explicit "No data found" row,
 * so an empty result is a real answer here, not page drift.
 */
export function parseRechargeTransactions(html: string): { tables: { columns: string[]; rows: string[][] }[] } {
  const table = readTable(html, PAYMENT_COLUMN);
  if (!table) {
    throw changedPage();
  }
  const rows = table.rows.filter((row) => !/no data found/i.test(row.join(" ")));
  return { tables: [{ columns: table.columns, rows }] };
}

export async function getRechargeTransactions(ctx: ToolContext) {
  const html = await ctx.http.text("/en/user/transaction");
  if (isEmailGate(html)) {
    throw unverifiedEmail();
  }
  if (isLoginPage(html)) {
    throw rejectedCredentials();
  }
  return parseRechargeTransactions(html);
}
