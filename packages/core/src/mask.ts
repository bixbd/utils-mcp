/** Last four characters only. The AI rarely needs a full account or meter number. */
export function maskLast4(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length >= 4 ? value.slice(-4) : null;
}
