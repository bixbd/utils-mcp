import { defineConnector, defineTool, noAuth, z } from "@bixbd/utils-mcp-core";
import { ACTIONS, history, meterStatus } from "./client";

const tables = z.array(z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }));

const historyOutput = z.object({
  meterLast4: z.string().nullable(),
  tables,
  verifiedWithLiveAccount: z.literal(false),
});

const statusOutput = z.object({
  meterLast4: z.string().nullable(),
  office: z.string(),
  feederName: z.string(),
  tariff: z.string(),
  meterType: z.string(),
  meterStatus: z.string(),
  approvedLoadKw: z.string(),
  minRecharge: z.string(),
  balance: z.string(),
  balanceUpdatedAt: z.string().nullable(),
  verifiedWithLiveAccount: z.literal(false),
});

export const nesco = defineConnector({
  id: "nesco",
  version: "0.2.0",
  status: "beta",
  description: "NESCO prepaid meter status, recharge history and monthly usage (unofficial; account responses unverified)",
  baseUrl: "https://customer.nesco.gov.bd",
  auth: noAuth(),
  tools: [
    defineTool({
      name: "get_meter_status",
      description: "Get NESCO prepaid meter balance, reading timestamp, tariff and meter state (no personal details). Use when asked about the current balance.",
      access: "read", input: z.object({}), output: statusOutput,
      handler: (_input, ctx) => meterStatus(ctx),
    }),
    defineTool({
      name: "get_recharge_history",
      description: "Get NESCO prepaid recharge history for the configured authorized meter. Use when asked about past recharges.",
      access: "read", input: z.object({}), output: historyOutput,
      handler: (_input, ctx) => history(ctx, ACTIONS.rechargeHistory),
    }),
    defineTool({
      name: "get_monthly_usage",
      description: "Get NESCO prepaid monthly consumption for the configured authorized meter. Use when asked about electricity usage.",
      access: "read", input: z.object({}), output: historyOutput,
      handler: (_input, ctx) => history(ctx, ACTIONS.monthlyUsage),
    }),
  ],
});

export default nesco;
