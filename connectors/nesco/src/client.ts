import { maskLast4, UtilsError, type ToolContext } from "@bixbd/utils-mcp-core";
import { load } from "cheerio";

/** The single Laravel form both read-only actions go through. */
const PANEL_PATH = "/pre/panel";

const changed = () => new UtilsError("UPSTREAM_CHANGED", "NESCO returned an unrecognized page", "Check the portal manually; its HTML may have changed.");

/** The portal answers 2xx but re-renders the bare form when the number is unknown. */
const notFound = () => new UtilsError("NOT_FOUND", "NESCO has no prepaid record for this number", "Check the meter or customer number; the portal shows a plain form for unknown numbers.");

export const ACTIONS = {
  rechargeHistory: "রিচার্জ হিস্ট্রি",
  monthlyUsage: "মাসিক ব্যবহার",
} as const;

export type PanelAction = (typeof ACTIONS)[keyof typeof ACTIONS];

/** Bengali composes য় in two encodings; compare only through NFC-normalized text. */
const norm = (value: string) => value.normalize("NFC");

export function meterId(ctx: ToolContext): string {
  const meter = ctx.secrets.get("NESCO_METER_ID");
  if (!meter) {
    throw new UtilsError("AUTH_REQUIRED", "NESCO meter is not configured", "Set NESCO_METER_ID to a customer or meter number you own or have permission to access.");
  }
  if (!/^\d{8,11}$/.test(meter)) {
    throw new UtilsError("INVALID_INPUT", "Invalid NESCO meter number", "NESCO_METER_ID must contain 8–11 digits.");
  }
  return meter;
}

/** GET the panel for cookies + CSRF, then POST one action. Two requests per call is deliberate: tokens expire with the session. */
async function postPanel(ctx: ToolContext, meter: string, action: PanelAction): Promise<string> {
  const token = load(await ctx.http.text(PANEL_PATH))("form#customer-form input[name=\"_token\"]").attr("value");
  if (!token) {
    throw changed();
  }
  return ctx.http.text(PANEL_PATH, {
    method: "POST",
    form: { _token: token, cust_no: meter, submit: action },
  });
}

export async function history(ctx: ToolContext, action: PanelAction) {
  const meter = meterId(ctx);
  const html = await postPanel(ctx, meter, action);
  let tables;
  try {
    tables = parseHistory(html);
  } catch (error) {
    // A 200 with the plain form (and no record grid) means the number is unknown,
    // not that the site changed. Anything else is genuine drift.
    if (isNotFound(html)) {
      throw notFound();
    }
    throw error;
  }
  return { meterLast4: maskLast4(meter), tables, verifiedWithLiveAccount: false as const };
}

export async function meterStatus(ctx: ToolContext) {
  const meter = meterId(ctx);
  const html = await postPanel(ctx, meter, ACTIONS.monthlyUsage);
  const profile = parseProfile(html);
  if (!profile) {
    if (isNotFound(html)) {
      throw notFound();
    }
    throw changed();
  }
  return { meterLast4: maskLast4(meter), ...profile, verifiedWithLiveAccount: false as const };
}

const clean = (value: string) => value.replace(/\s+/g, " ").trim()
    .replace(/[0-9০-৯]{8,}/g, (id) => `****${id.slice(-4)}`);

/** Only history tables leave the connector; profile fields and token attributes do not. */
export function parseHistory(html: string) {
  const $ = load(html);
  const tables: { columns: string[]; rows: string[][] }[] = [];
  $("table").each((_i, table) => {
    const columns = $(table).find("tr").first().find("th,td").toArray().map((cell) => clean($(cell).text()));
    if (!columns.some((column) => /date|month|year|তারিখ|মাস|বছর/i.test(column))) {
      return;
    }
    const rows = $(table).find("tr").slice(1).toArray().map((row) =>
      $(row).find("td").toArray().map((cell) => clean($(cell).text()))).filter((row) => row.length > 0);
    if (rows.some((row) => row.length !== columns.length)) {
      throw changed();
    }
    tables.push({ columns, rows });
  });
  if (tables.length === 0) {
    // An unknown page is never presented as an empty history or a zero balance.
    throw changed();
  }
  return tables;
}

/** Bengali label prefixes that identify the profile grid's value inputs. Unique, so none is a prefix of another. */
const PROFILE_PREFIXES = {
  office: "সংশ্লিষ্ট বিদ্যুৎ অফিস",
  feederName: "ফিডারের নাম",
  tariff: "অনুমোদিত ট্যারিফ",
  meterType: "মিটারের ধরণ",
  meterStatus: "মিটার স্ট্যাটাস",
  approvedLoadKw: "অনুমোদিত লোড",
  minRecharge: "মিনিমাম রিচার্জের পরিমাণ",
  balance: "অবশিষ্ট ব্যালেন্স",
} as const;

/** The total balance appears exactly once, with its reading timestamp inside the label. */
const BALANCE_PREFIX = "অবশিষ্ট ব্যালেন্স";

type MeterProfile = {
  office: string;
  feederName: string;
  tariff: string;
  meterType: string;
  meterStatus: string;
  approvedLoadKw: string;
  minRecharge: string;
  balance: string;
  balanceUpdatedAt: string | null;
};

/**
 * Reads the operational fields of the profile grid by matching each Bengali
 * label and taking the value from the disabled input in the following div.
 * Name, address, mobile, and the numeric identifiers never leave the portal page.
 */
export function parseProfile(html: string): MeterProfile | null {
  const $ = load(html);
  const labels = [...$("label").toArray()]
    .map((el) => ({ el, text: norm($(el).text().replace(/\s+/g, " ").trim()) }));
  const findLabel = (prefix: string) =>
    labels.find(({ text }) => text.startsWith(norm(prefix)));

  if (!findLabel(BALANCE_PREFIX)) {
    // No record grid at all → the number matched nothing;
    // meterStatus distinguishes a bare form (NOT_FOUND) from real drift (UPSTREAM_CHANGED).
    return null;
  }

  const valueOf = (prefix: string) => {
    const label = findLabel(prefix)?.el;
    if (!label) {
      return "";
    }
    const column = $(label).closest("div");
    const next = column.next("div").length ? column.next("div") : column.parent().next("div");
    return clean(next.first().find("input").first().attr("value") ?? "");
  };

  const balanceLabel = findLabel(BALANCE_PREFIX);
  if (!balanceLabel) {
    return null;
  }
  const escapedMarker = norm("সময়").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reading = balanceLabel.text.match(new RegExp(`${escapedMarker}[ঃ:]\\s*([^)]+?)\\s*\\)`));
  const balanceUpdatedAt = reading?.[1]?.trim() ?? null;

  const fields = Object.fromEntries(
    Object.entries(PROFILE_PREFIXES).map(([key, prefix]) => [key, valueOf(prefix)]),
  ) as Omit<MeterProfile, "balanceUpdatedAt">;

  return { ...fields, balanceUpdatedAt };
}

/** True when the portal answered normally (bare form) but has no record grid for the number. */
export function isNotFound(html: string): boolean {
  return !hasResult(html) && load(html)("form#customer-form").length > 0;
}

/** True when the response contains the profile grid (any meter data at all). */
export function hasResult(html: string): boolean {
  const $ = load(html);
  return $("label").toArray()
    .some((el) => norm($(el).text().replace(/\s+/g, " ").trim()).startsWith(norm(BALANCE_PREFIX)));
}
