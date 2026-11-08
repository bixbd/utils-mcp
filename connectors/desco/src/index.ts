import { defineConnector, formLogin } from "@bixbd/utils-mcp-core";
import { tools } from "./tools";

/**
 * DESCO prepaid electricity portal (https://prepaid.desco.org.bd/).
 * Unofficial. Flow follows KhBayazidAhmed/desco-prepaid-api: CSRF cookie, login,
 * session cookies, then the portal's JSON API.
 * Use only accounts you own or have permission to access.
 *
 * Layout: client/ talks to the portal, schemas/ describes data, tools/ defines what the AI can call.
 */
export const desco = defineConnector({
  id: "desco",
  version: "0.3.0",
  status: "beta",
  description: "DESCO prepaid electricity: accounts, balance, usage, recharges, tariffs, notices and recharge points (unofficial)",
  baseUrl: "https://prepaid.desco.org.bd/api",
  auth: formLogin({
    csrfPath: "/auth/csrf",
    loginPath: "/auth/login",
    secrets: { username: "DESCO_USERNAME", password: "DESCO_PASSWORD" }, // guard:allow-secret env var names, not values
  }),
  tools,
});

export default desco;
