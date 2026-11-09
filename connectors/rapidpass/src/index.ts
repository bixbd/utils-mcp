import { defineConnector, htmlFormLogin } from "@bixbd/utils-mcp-core";
import { rapidPassTools } from "./tools";

/**
 * RapidPass (Bangladesh transit smart card) — rapidpass.com.bd.
 * Unofficial. The portal is a Laravel HTML app: login replays the page's
 * hidden `_token` and `csSignature` inputs, every read-only page is
 * server-rendered HTML, and each card binds its own JSON payload.
 * Use only accounts you own or have permission to access.
 */
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
  tools: rapidPassTools,
});

export default rapidpass;

export {
  getCards,
  getRechargeTransactions,
  getTravelHistory,
  isEmailGate,
  isLoginPage,
  parseCards,
  parseRechargeTransactions,
  parseTravelHistory,
  type RapidPassCard,
  type TravelHistoryCard,
  type TravelOperation,
} from "./client";
