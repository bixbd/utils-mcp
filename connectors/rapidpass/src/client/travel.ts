import { type ToolContext } from "@bixbd/utils-mcp-core";
import { changedPage } from "./gates";
import { fetchDashboard } from "./cards";
import { sanitize } from "../text";

/**
 * The portal binds every card's full payload (name, phone, address, NID,
 * transaction history, …) into its card's click-handler attribute,
 * HTML-entity-encoded. Text values only.
 */
const CARD_PAYLOAD = /@click=['"]handleCardClick\(([\s\S]*?)\)\s*['"]/g;

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

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Maps a raw payload through a **whitelist**: only the operation fields leave.
 * The payloads also carry phone numbers, names, addresses and national-ID
 * data, which never reach the tool output.
 */
function toHistoryCard(payload: Record<string, unknown>): TravelHistoryCard {
  if (typeof payload.card_number !== "string") {
    throw changedPage();
  }
  const history = Array.isArray(payload.transaction_history) ? payload.transaction_history as Record<string, unknown>[] : [];

  return {
    cardNumber: sanitize(payload.card_number),
    serverStatus: typeof payload.server_status === "string" ? payload.server_status : null,
    syncStatus: typeof payload.sync_status === "string" ? payload.sync_status : null,
    balanceBdt: typeof payload.balance === "string" || typeof payload.balance === "number" ? sanitize(String(payload.balance)) : null,
    lastUpdatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
    operations: history.map((row) => ({
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
  };
}

/** One TravelHistoryCard per card payload embedded in the dashboard HTML. */
export function parseTravelHistory(html: string): TravelHistoryCard[] {
  const historyCards: TravelHistoryCard[] = [];
  for (const match of html.matchAll(CARD_PAYLOAD)) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(decodeEntities(match[1] ?? "")) as Record<string, unknown>;
    } catch {
      throw changedPage();
    }
    historyCards.push(toHistoryCard(payload));
  }
  return historyCards;
}

export async function getTravelHistory(ctx: ToolContext): Promise<{ cards: TravelHistoryCard[] }> {
  const html = await fetchDashboard(ctx);
  const cards = parseTravelHistory(html);
  return { cards };
}
