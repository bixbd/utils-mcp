import { z } from "@bixbd/utils-mcp-core";

export const cardsSchema = z.object({
  cards: z.array(z.object({
    cardNumber: z.string(),
    status: z.string(),
    balanceBdt: z.string(),
  })),
});

export const travelSchema = z.object({
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

export const transactionsSchema = z.object({
  tables: z.array(z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })),
});
