import { load } from "cheerio";
import { UtilsError, type ToolContext } from "@bixbd/utils-mcp-core";
import { changedPage, isLoginPage, rejectedCredentials } from "./gates";
import { sanitize } from "../text";

export type RapidPassCard = {
  cardNumber: string;
  status: string;
  balanceBdt: string;
};

/** Reads the card grid of /en/user/home (the English page keeps digits ASCII). */
export function parseCards(html: string): RapidPassCard[] {
  const $ = load(html);
  const cards: RapidPassCard[] = [];

  for (const info of $("._rp_card .info").toArray()) {
    const spanFor = (label: string) =>
      $(info).find("p").filter((_p, el) => $(el).text().trim().startsWith(label)).first().find("span").first().text();
    const cardNumber = sanitize(spanFor("Card Number:"));
    const status = sanitize(spanFor("Card Status:"));
    const balance = sanitize(spanFor("Balance:").replace("৳", "").trim());

    if (!cardNumber || !status) {
      continue;
    }
    cards.push({ cardNumber, status, balanceBdt: balance });
  }

  if (cards.length === 0 && $("._rp_card").length > 0) {
    throw changedPage();
  }
  return cards;
}

export async function getCards(ctx: ToolContext): Promise<{ cards: RapidPassCard[] }> {
  const html = await fetchDashboard(ctx);
  return { cards: parseCards(html) };
}

/** The user dashboard is the only page carrying #pageApp; anything else is not a session page. */
export async function fetchDashboard(ctx: ToolContext): Promise<string> {
  const html = await ctx.http.text("/en/user/home");
  if (isLoginPage(html)) {
    throw rejectedCredentials();
  }
  if (load(html)("#pageApp").length === 0) {
    throw new UtilsError(
      "UPSTREAM_CHANGED",
      "Rapid Pass returned a page that is not the user dashboard",
      "Check rapidpass.com.bd manually; its HTML may have changed.",
    );
  }
  return html;
}
