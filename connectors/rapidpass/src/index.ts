import { defineConnector, defineTool, htmlFormLogin, z } from "@bixbd/utils-mcp-core";
import { getCards, getRechargeTransactions, getTravelHistory } from "./client";

const tables = z.array(z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }));

const cardsOutput = z.object({
  cards: z.array(z.object({
    cardNumber: z.string(),
    status: z.string(),
    balanceBdt: z.string(),
  })),
});

const travelOutput = z.object({
  cards: z.array(z.object({
    cardNumber: z.string(),
    serverStatus: z.string().nullable(),
    syncStatus: z.string().nullable(),
    balanceBdt: z.string().nullable(),
    lastUpdatedAt: z.string().nullable(),
    operations: z.array(z.object({
      operationType: z.string(),
      originStation: z.string(),
      originDate: z.string(),
      originTime: z.string(),
      destinationStation: z.string(),
      destinationDate: z.string(),
      destinationTime: z.string(),
      vehicleType: z.string().nullable(),
      isPenalty: z.boolean(),
      spentAmountBdt: z.string(),
      balanceBdt: z.string(),
    })),
  })),
});

export const rapidpass = defineConnector({
  id: "rapidpass",
  version: "0.1.0",
  status: "beta",
  description: "RapidPass (Bangladesh transit smart card): registered cards, travel history and portal recharge transactions (unofficial)",
  baseUrl: "https://rapidpass.com.bd",
  auth: htmlFormLogin({
    pagePath: "/login",
    loginPath: "/login",
    secrets: { username: "RAPIDPASS_EMAIL", password: "RAPIDPASS_PASSWORD" }, // guard:allow-secret env var names, not values
    fields: { username: "email_or_mobile", password: "password" }, // guard:allow-secret env var names, not values
    hiddenFields: ["_token", "csSignature"],
  }),
  tools: [
    defineTool({
      name: "get_cards",
      description: "List RapidPass smart cards registered to the account: number, status and balance. Use when asked about RapidPass cards or balances.",
      access: "read", input: z.object({}), output: cardsOutput,
      handler: (_input, ctx) => getCards(ctx),
    }),
    defineTool({
      name: "get_travel_history",
      description: "Get RapidPass travel/recharge history per card (gates, balance per leg) as submitted by the transport operator. Use when asked about rides, fares or tap history.",
      access: "read", input: z.object({}), output: travelOutput,
      handler: (_input, ctx) => getTravelHistory(ctx),
    }),
    defineTool({
      name: "get_recharge_transactions",
      description: "Get RapidPass portal recharge transactions (online top-up payments). Requires a verified-only account; returns portal payment rows. Use when asked about RapidPass top-up payments.",
      access: "read", input: z.object({}), output: z.object({ tables }),
      handler: (_input, ctx) => getRechargeTransactions(ctx),
    }),
  ],
});

export default rapidpass;
