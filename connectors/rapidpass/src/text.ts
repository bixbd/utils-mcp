/**
 * Shared text normalization for portal output.
 */

/**
 * Bengali numerals only appear on the Bangla pages; normalizing digits first
 * keeps every parser locale-agnostic.
 */
export function fromBengaliDigits(value: string): string {
  return value.replace(/[০-৯]/g, (character) => String("০১২৩৪৫৬৭৮৯".indexOf(character)));
}

/**
 * Flattens whitespace and masks every 8+ digit run, so identifiers such as
 * card numbers can never leave the connector in full.
 */
export function sanitize(value: string): string {
  return fromBengaliDigits(value.replace(/\s+/g, " ").trim())
    .replace(/[0-9]{8,}/g, (id) => `****${id.slice(-4)}`);
}
