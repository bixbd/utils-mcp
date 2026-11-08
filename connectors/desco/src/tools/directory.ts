import { z } from "@bixbd/utils-mcp-core";
import { publicGet, publicSearch } from "./factories";

/** Public lookups: where to recharge, meter manuals, tutorials. */
export const directoryTools = [
  publicSearch(
    "find_recharge_points",
    "Search DESCO prepaid recharge points (POS shops) by text, bank or area. Bank and area values must match the portal exactly, for example bank 'MYCash', area 'Mirpur'.",
    "/public/pos-locations",
    {
      q: z.string().optional().describe("Free-text search on shop name or address."),
      bank: z.string().optional(),
      area: z.string().optional(),
    },
  ),
  publicGet("list_recharge_point_filters", "Valid bank and area values for find_recharge_points.", "/public/pos-locations/filters"),
  publicSearch(
    "find_meter_manuals",
    "Search prepaid meter user manuals (PDF) by manufacturer, phase (SINGLE or THREE) and language.",
    "/public/meter-manuals",
    {
      q: z.string().optional(),
      manufacturer: z.string().optional(),
      phase: z.enum(["SINGLE", "THREE"]).optional(),
      locale: z.string().optional(),
    },
  ),
  publicSearch("find_tutorials", "Search DESCO prepaid video tutorials by text, category and language.", "/public/tutorials", {
    q: z.string().optional(),
    category: z.string().optional(),
    locale: z.string().optional(),
  }),
];
