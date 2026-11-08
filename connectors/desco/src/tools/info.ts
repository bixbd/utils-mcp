import { defineTool, z } from "@bixbd/utils-mcp-core";
import { DataOut } from "../schemas";
import { publicGet } from "./factories";

const listNotices = defineTool({
  name: "list_notices",
  description: "Active DESCO portal notices, or the important homepage notices (monthly charges, recharge deductions).",
  access: "read",
  input: z.object({ kind: z.enum(["active", "homepage"]).default("active") }),
  output: DataOut,
  handler: async (input, ctx) => ({ data: await ctx.http.json(`/public/notices/${input.kind}`, z.unknown()) }),
});

/** Public reference information: prices, notices, FAQ, meter codes, documents. */
export const infoTools = [
  publicGet(
    "get_tariff",
    "Current DESCO retail electricity tariff: unit slabs, rates per kWh and demand charges by customer class. Use for price-per-unit questions.",
    "/public/tariff-schedules/current",
  ),
  listNotices,
  publicGet("list_faqs", "DESCO prepaid FAQ in Bangla and English.", "/public/faqs"),
  publicGet(
    "list_short_codes",
    "Prepaid meter keypad short codes (e.g. 801 shows balance), grouped by purpose, with meter and phase applicability.",
    "/public/prepaid-short-codes",
  ),
  publicGet(
    "list_tariff_documents",
    "Current tariff orders and circulars published by DESCO, with titles and summaries.",
    "/public/documents/tariffs/current",
  ),
  publicGet("list_documents", "All published DESCO tariff documents, forms, circulars and policies.", "/public/documents"),
];
