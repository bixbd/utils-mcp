import { defineTool, z } from "@bixbd/utils-mcp-core";
import { getCards } from "../client/cards";
import { getRechargeTransactions } from "../client/transactions";
import { getTravelHistory } from "../client/travel";
import { cardsSchema, transactionsSchema, travelSchema } from "../schemas";

export const rapidPassTools = [
  defineTool({
    name: "get_cards",
    description: "List RapidPass smart cards registered to the account: number, status and balance. Use when asked about RapidPass cards or balances.",
    access: "read",
    input: z.object({}),
    output: cardsSchema,
    handler: (_input, ctx) => getCards(ctx),
  }),
  defineTool({
    name: "get_travel_history",
    description: "Get RapidPass travel/recharge history per card (gates, fares, balance per leg) as submitted by the transport operator. Use when asked about rides, fares or tap history.",
    access: "read",
    input: z.object({}),
    output: travelSchema,
    handler: (_input, ctx) => getTravelHistory(ctx),
  }),
  defineTool({
    name: "get_recharge_transactions",
    description: "Get RapidPass portal top-up payments. Needs a verified account email; otherwise reports EMAIL_VERIFICATION_REQUIRED. Use when asked about RapidPass online recharge payments.",
    access: "read",
    input: z.object({}),
    output: transactionsSchema,
    handler: (_input, ctx) => getRechargeTransactions(ctx),
  }),
];
