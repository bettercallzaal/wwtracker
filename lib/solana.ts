// Base58 alphabet (Bitcoin/Solana variant): no 0, O, I, l.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Validate a Solana address. Solana keys are 32 raw bytes which base58-encode to
 * 32-44 chars. We do a cheap structural check (length + alphabet) rather than a
 * full curve-point check - enough to reject junk before spending a Dune credit.
 */
export function isValidSolanaAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 32 || value.length > 44) return false;
  return BASE58.test(value);
}
