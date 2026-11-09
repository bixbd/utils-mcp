import { load } from "cheerio";
import { UtilsError, type ToolContext } from "@bixbd/utils-mcp-core";

const changed = () => new UtilsError("UPSTREAM_CHANGED", "Rapid Pass returned an unrecognized page", "Check rapidpass.com.bd manually; its HTML may have changed.");

/** Gated pages answer with the email-verification banner instead of data. */
const emailGate = () => new UtilsError("EMAIL_VERIFICATION_REQUIRED", "Rapid Pass account email is not verified", "Sign in on rapidpass.com.bd and verify the email (an OTP arrives by mail), then retry.");

const authRejected = () => new UtilsError("AUTH_REQUIRED", "Rapid Pass rejected the credentials", "Fix RAPIDPASS_EMAIL / RAPIDPASS_PASSWORD and restart the server.");

const DASHBOARD = "/en/user/home";
const TRANSACTIONS = "/en/user/transaction";

/** Bengali numerals only appear on the Bangla pages; normalization keeps parsers locale-agnostic. */
const digits = (value: string) => value.replace(/[০-৯]/g, (ch) => String("০১২৩৪৫৬৭৮৯".indexOf(ch)));
const clean = (value: string) => digits(value.replace(/\s+/g, " ").trim())
    .replace(/[0-9]{8,}/g, (id) => `****${id.slice(-4)}`);

/** True when the session got bounced back to the login form. */
export function isLoginPage(html: string): boolean {
  return load(html)(`input[name="email_or_mobile"]`).length > 0;
}

/** True when a gated page answered with the email-verification banner. */
export function isEmailGate(html: string): boolean {
  const $ = load(html);
  return $("[src*='email-not-verified'], a[href*='email-not-verified']").length > 0
    || (/ইমেইল ভেরিফিকেশন|verify your email/i).test($.text());
}

/* ------------------------------------------------------------- parsers */

/** True when the session got bounced back to the login form. */
export type RapidPassCard = { cardNumber: string; status: string; balanceBdt: string };

/** Reads the card grid of /en/user/home (the English page keeps digits ASCII). */
export function parseCards(html: string): RapidPassCard[] {
  const $ = load(html);
  const cards: RapidPassCard[] = [];
  $("._rp_card .info").each((_i, info) => {
    const text = (label: string) =>
      clean($(info).find("p").filter((_p, el) => $(el).text().trim().startsWith(label)).first().find("span").first().text());
    const cardNumber = text("Card Number:");
    const status = text("Card Status:");
    const balance = clean(text("Balance:").replace("৳", "").trim());
    if (!cardNumber || !status) {
      return;
    }
    cards.push({ cardNumber, status, balanceBdt: balance });
  });
  if (cards.length === 0 && $("._rp_card").length > 0) {
    throw changed();
  }
  return cards;
}

export type TravelOperation = {
  operationType: string;
  originStation: string;
  originDate: string;
  originTime: string;
  destinationStation: string;
  destinationDate: string;
  destinationTime: string;
  vehicleType: string | null;
  isPenalty: boolean;
  spentAmountBdt: string;
  balanceBdt: string;
};

export type TravelHistoryCard = {
  cardNumber: string;
  serverStatus: string | null;
  syncStatus: string | null;
  balanceBdt: string | null;
  lastUpdatedAt: string | null;
  operations: TravelOperation[];
};

/** The portal binds each card's full payload into a click handler attribute, HTML-entity-encoded. */
const CARD_PAYLOAD = /@click=['"]handleCardClick\(([\s\S]*?)\)\s*['"]/g;

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Reads the cards' embedded payloads (each @click='handleCardClick({…})') and
 * maps them through a **whitelist**: only the operation fields leave. The
 * payloads also carry phone numbers, names, addresses and national-ID data,
 * which never reach the tool output.
 */
export function parseTravelHistory(html: string): TravelHistoryCard[] {
  const historyCards: TravelHistoryCard[] = [];
  for (const match of html.matchAll(CARD_PAYLOAD)) {
    const payloadSource = match[1];
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(decodeEntities(payloadSource ?? "")) as Record<string, unknown>;
    } catch {
      throw changed();
    }
    if (typeof payload.card_number !== "string") {
      throw changed();
    }
    const rows = Array.isArray(payload.transaction_history) ? payload.transaction_history as Record<string, unknown>[] : [];
    historyCards.push({
      cardNumber: clean(payload.card_number),
      serverStatus: typeof payload.server_status === "string" ? payload.server_status : null,
      syncStatus: typeof payload.sync_status === "string" ? payload.sync_status : null,
      balanceBdt: typeof payload.balance === "string" || typeof payload.balance === "number" ? clean(String(payload.balance)) : null,
      lastUpdatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
      operations: rows.map((row) => ({
        operationType: typeof row.service_type === "string" ? row.service_type : "",
        originStation: typeof row.origin_station === "string" ? row.origin_station : "",
        originDate: typeof row.origin_date_stamp === "string" ? row.origin_date_stamp : "",
        originTime: typeof row.origin_time_stamp === "string" ? row.origin_time_stamp : "",
        destinationStation: typeof row.destination_station === "string" ? row.destination_station : "",
        destinationDate: typeof row.date_stamp === "string" ? row.date_stamp : "",
        destinationTime: typeof row.time_stamp === "string" ? row.time_stamp : "",
        vehicleType: typeof row.vehicle_type === "string" && row.vehicle_type.length > 0 ? row.vehicle_type : null,
        isPenalty: row.is_penalty === true,
        spentAmountBdt: typeof row.spent_amount === "string" || typeof row.spent_amount === "number" ? String(row.spent_amount) : "",
        balanceBdt: typeof row.balance === "string" || typeof row.balance === "number" ? String(row.balance) : "",
      })),
    });
  }
  return historyCards;
}

/* -------------------------------------------------------------- callers */

async function dashboard(ctx: ToolContext) {
  const html = await ctx.http.text(DASHBOARD);
  if (isLoginPage(html)) {
    throw authRejected();
  }
  // The user dashboard is the only server-rendered place with #pageApp; a page
  // without it is not a session page at all.
  if (load(html)("#pageApp").length === 0) {
    throw changed();
  }
  return html;
}

export async function getCards(ctx: ToolContext) {
  const html = await dashboard(ctx);
  return { cards: parseCards(html) };
}

export async function getTravelHistory(ctx: ToolContext) {
  const html = await dashboard(ctx);
  return { cards: parseTravelHistory(html) };
}

export async function getRechargeTransactions(ctx: ToolContext) {
  const html = await ctx.http.text(TRANSACTIONS);
  if (isEmailGate(html)) {
    throw emailGate();
  }
  if (isLoginPage(html)) {
    throw authRejected();
  }
  const $ = load(html);
  const table = $("table").first();
  if (table.length === 0 || table.find("th").filter((_th, el) => /Payment ID/i.test($(el).text())).length === 0) {
    throw changed();
  }
  const columns = table.find("thead th, tbody th").toArray().map((th) => clean($(th).text()));
  const rows = table.find("tbody tr")
    .toArray()
    .map((tr) => $(tr).find("td").toArray().map((td) => clean($(td).text())))
    .filter((row) => row.length === columns.length && !/no data found/i.test(row.join(" ")));
  return { tables: [{ columns, rows }] };
}
