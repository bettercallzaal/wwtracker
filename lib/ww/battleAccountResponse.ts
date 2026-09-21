/**
 * What `/api/ww/battle-account` hands the widget, decoded in one place.
 *
 * THREE READERS, TWO LAYOUTS, ONE UNTRUE COMMENT. The route decoded the pools
 * at bytes 228 and 236 and said they were "the same offsets lib/battlePositions
 * decodes". `decodeBattle` reads 212 and 220; so does `battleStateFromRaw`.
 * Nothing broke because 228/236 are byte-identical duplicates of 212/220 on
 * every account decoded so far (chain/BATTLE-ACCOUNT.md in the protocol repo:
 * 1,643 of 1,643; re-measured 2026-09-21 on two live accounts and the buy
 * fixture). A duplicate that has always agreed is the kind of thing that stops
 * agreeing on the day the program is upgraded, and the widget would then price
 * a sell off the wrong number with no error anywhere.
 *
 * So: one decoder, the same offsets as `decodeBattle`, pinned against it in
 * `wwBattleAccountResponse.test.ts`. Lamports and base units, never SOL, because
 * the quote works in lamports and converting twice is how rounding gets in.
 */

/** The layout is 353 bytes; everything this reads is inside the first 246. */
const MIN_LENGTH = 246;

export interface BattleAccountResponse {
  poolALamports: number;
  poolBLamports: number;
  /** Minted supply per side, base units (bytes 196 and 204). The sell quote needs these. */
  supplyA: number;
  supplyB: number;
  /** Unix seconds. The widget's clock. */
  endTime: number;
  /** The MARKET winner byte (244): the larger pool, not the judged result. */
  winnerArtistA: boolean;
  /** Byte 245, `winner_decided`: the program has settled this battle. */
  settled: boolean;
}

export function decodeBattleAccountResponse(raw: Uint8Array): BattleAccountResponse {
  if (raw.length < MIN_LENGTH) {
    throw new Error(`battle account is ${raw.length} bytes, ${MIN_LENGTH} needed to decode pools and supplies`);
  }
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const u64 = (o: number) => Number(dv.getBigUint64(o, true));
  return {
    poolALamports: u64(212),
    poolBLamports: u64(220),
    supplyA: u64(196),
    supplyB: u64(204),
    endTime: Number(dv.getBigInt64(28, true)),
    winnerArtistA: raw[244] !== 0,
    settled: raw[245] !== 0,
  };
}
