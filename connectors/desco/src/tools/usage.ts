import { z } from "@bixbd/utils-mcp-core";
import { accountGet, dateInput, monthInput } from "./factories";

/** Consumption over time, signed in. */
export const usageTools = [
  accountGet("get_daily_usage", "Daily electricity usage for a date range. Dates are YYYY-MM-DD.", "/usage/daily", {
    dateFrom: dateInput,
    dateTo: dateInput,
  }),
  accountGet("get_monthly_usage", "Monthly electricity usage for a month range. Months are YYYY-MM.", "/usage/monthly", {
    monthFrom: monthInput,
    monthTo: monthInput,
  }),
  accountGet(
    "get_consumption_comparison",
    "Compare monthly consumption this year against last year, up to an end month.",
    "/consumption-comparison",
    { year: z.number().int().min(2000).max(2100).optional(), endMonth: z.number().int().min(1).max(12).optional() },
  ),
  accountGet(
    "get_energy_vs_consumed_taka",
    "Energy (kWh) versus money consumed (BDT) per month. Months are YYYY-MM.",
    "/energy-vs-consumed-taka",
    { monthFrom: monthInput, monthTo: monthInput },
  ),
];
