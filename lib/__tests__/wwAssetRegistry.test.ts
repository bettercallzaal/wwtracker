/**
 * PRD section 16, the Approved Asset Registry.
 *
 * THE TEST THAT MATTERS MOST IS THE ONE ABOUT REFUSING. Eight of the sixteen
 * fields are policy or market data, and the point of this module is that it will
 * not invent them. A defaulted `maximum_slippage` would be a number nobody
 * chose, sitting in a field whose entire purpose is to record that somebody
 * chose it, and it would look exactly like one that had been considered.
 *
 * The metadata tests are the second half, and they exist because the answer was
 * not what anyone would assume. Measured across the three real fixtures:
 *
 *     WaveWarZ battle mint   neither source resolves
 *     PYUSD                  Token-2022 tokenMetadata extension
 *     USDC                   Metaplex metadata PDA
 *
 * Two sources, one asset each, and one asset with no name at all. **Our own
 * battle mints have no metadata**, so a registry row for one carries null symbol
 * and null name - which is the case a guessed default would have hidden.
 */
import { describe, expect, it } from "vitest";
import fixtures from "../__fixtures__/ww-mint-accounts.json";
import {
  IncompletePolicyError,
  buildAssetRegistryRow,
  isStale,
  metaplexMetadataAddress,
  parseMetaplexMetadata,
  tokenMetadataFromMintAccount,
  missingPolicyFields,
  type AssetPolicy,
} from "../ww/assetRegistry";
import { checkTokenEligibility, type ParsedMintAccount } from "../ww/tokenEligibility";

const mints = fixtures.mints as Record<string, { mint: string; account: ParsedMintAccount | null }>;
const report = (key: string) => {
  const f = mints[key];
  return checkTokenEligibility(f.mint, f.account);
};

/** A complete policy, so the refusal tests can remove exactly one thing. */
const POLICY: AssetPolicy = {
  operator_id: "wavewarz",
  entry_enabled: false,
  exit_enabled: false,
  minimum_liquidity: 50_000_000_000,
  maximum_price_impact: 100,
  maximum_slippage: 300,
  routing_status: "unverified",
  status: "pending",
};

const NOW = () => new Date("2026-09-18T20:30:00.000Z");

describe("token metadata resolves from two sources, and sometimes neither", () => {
  it("finds nothing for our own battle mint", () => {
    const account = mints.wavewarz_battle_mint.account;
    expect(tokenMetadataFromMintAccount(account)).toBeNull();
    // And it has no Metaplex account either - measured, not assumed.
    expect(fixtures.metaplex_metadata.for).not.toBe(mints.wavewarz_battle_mint.mint);
  });

  it("reads PYUSD's name from its Token-2022 extension", () => {
    const md = tokenMetadataFromMintAccount(mints.token_2022_pyusd.account);
    expect(md).toEqual({ name: "PayPal USD", symbol: "PYUSD", source: "token-2022-extension" });
  });

  it("reads USDC's name from its Metaplex account", () => {
    const raw = new Uint8Array(
      Buffer.from(fixtures.metaplex_metadata.account_base64 as string, "base64"),
    );
    expect(parseMetaplexMetadata(raw)).toEqual({
      name: "USD Coin",
      symbol: "USDC",
      source: "metaplex",
    });
  });

  it("derives the Metaplex address rather than being told it", () => {
    expect(metaplexMetadataAddress(fixtures.metaplex_metadata.for as string)).toBe(
      fixtures.metaplex_metadata.address,
    );
  });

  /**
   * Metaplex strings are fixed-length and null-padded on chain. Leaving the
   * padding in puts "USD Coin\0\0\0..." in a registry row and in every UI that
   * renders it.
   */
  it("trims the null padding chain actually stores", () => {
    const raw = new Uint8Array(
      Buffer.from(fixtures.metaplex_metadata.account_base64 as string, "base64"),
    );
    const md = parseMetaplexMetadata(raw)!;
    expect(md.name).not.toMatch(/\0/);
    expect(md.name).toBe(md.name.trim());
  });

  it("returns null on an account that is not metadata, rather than throwing", () => {
    expect(parseMetaplexMetadata(new Uint8Array(0))).toBeNull();
    expect(parseMetaplexMetadata(new Uint8Array(64))).toBeNull();
    expect(parseMetaplexMetadata(new Uint8Array(200).fill(0xff))).toBeNull();
  });

  it("ignores a Token-2022 extension with an empty name", () => {
    expect(
      tokenMetadataFromMintAccount({
        data: { parsed: { type: "mint", info: { extensions: [{ extension: "tokenMetadata", state: { name: "  ", symbol: "X" } }] } } },
      }),
    ).toBeNull();
  });
});

describe("it refuses to build a row without the decisions", () => {
  const eligibility = report("usdc");
  const mint = mints.usdc.mint;

  it("throws when every policy field is missing, naming all eight", () => {
    expect(() => buildAssetRegistryRow({ mint, account: mints.usdc.account, eligibility, policy: {} }))
      .toThrow(IncompletePolicyError);
    try {
      buildAssetRegistryRow({ mint, account: mints.usdc.account, eligibility, policy: {} });
    } catch (e) {
      expect((e as IncompletePolicyError).missing).toHaveLength(8);
      expect((e as Error).message).toMatch(/decisions, not defaults/);
    }
  });

  /**
   * One at a time. A check that only fired on a wholly empty policy would pass
   * a row that was missing exactly the field somebody forgot.
   */
  it("throws for each field individually, and names that field", () => {
    for (const field of Object.keys(POLICY) as Array<keyof AssetPolicy>) {
      const partial = { ...POLICY };
      delete partial[field];
      expect(() => buildAssetRegistryRow({ mint, account: mints.usdc.account, eligibility, policy: partial }),
        `missing ${field}`).toThrow(new RegExp(field));
    }
  });

  /**
   * THE TRAP A FALSY CHECK WOULD FALL INTO. `entry_enabled: false` and
   * `maximum_price_impact: 0` are decisions somebody made - and for a new asset,
   * false is the most likely one. Treating falsy as absent would reject the
   * commonest correct row.
   */
  it("accepts false and zero as decisions, because they are", () => {
    const policy: AssetPolicy = {
      ...POLICY, entry_enabled: false, exit_enabled: false,
      minimum_liquidity: 0, maximum_price_impact: 0, maximum_slippage: 0,
    };
    expect(missingPolicyFields(policy)).toEqual([]);
    const row = buildAssetRegistryRow({ mint, account: mints.usdc.account, eligibility, policy, now: NOW });
    expect(row.entry_enabled).toBe(false);
    expect(row.maximum_price_impact).toBe(0);
  });

  it("reports what is missing without throwing, so a caller can ask first", () => {
    expect(missingPolicyFields({ operator_id: "x" }).sort()).toEqual(
      ["entry_enabled", "exit_enabled", "maximum_price_impact", "maximum_slippage",
       "minimum_liquidity", "routing_status", "status"],
    );
    expect(missingPolicyFields(null)).toHaveLength(8);
  });

  /**
   * A row built from another asset's review would record an approval nobody
   * gave for the asset it names. Cheap to check, and the kind of mix-up that
   * happens when two reports are in flight at once.
   */
  it("refuses an eligibility report for a different mint", () => {
    expect(() =>
      buildAssetRegistryRow({ mint, account: mints.usdc.account, eligibility: report("token_2022_pyusd"), policy: POLICY }),
    ).toThrow(/not/);
  });
});

describe("what a built row carries", () => {
  it("derives the chain fields from the eligibility report, not from a second read", () => {
    const row = buildAssetRegistryRow({
      mint: mints.usdc.mint, account: mints.usdc.account,
      eligibility: report("usdc"), policy: POLICY, now: NOW,
      metadata: parseMetaplexMetadata(new Uint8Array(Buffer.from(fixtures.metaplex_metadata.account_base64 as string, "base64")))!,
    });
    expect(row.decimals).toBe(6);
    expect(row.token_program).toBe("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    expect(row.transfer_fee_status).toBe("none");       // classic token cannot have one
    expect(row.freeze_authority_status).toBe("present"); // USDC has one
    expect(row.symbol).toBe("USDC");
    expect(row.metadata_source).toBe("metaplex");
    expect(row.last_verified_at).toBe("2026-09-18T20:30:00.000Z");
  });

  it("carries null symbol and name for an asset with no metadata, and says the source was none", () => {
    const row = buildAssetRegistryRow({
      mint: mints.wavewarz_battle_mint.mint, account: mints.wavewarz_battle_mint.account,
      eligibility: report("wavewarz_battle_mint"), policy: POLICY, now: NOW,
      metadata: tokenMetadataFromMintAccount(mints.wavewarz_battle_mint.account),
    });
    expect(row.symbol).toBeNull();
    expect(row.name).toBeNull();
    // Distinguishable from a lookup nobody performed.
    expect(row.metadata_source).toBe("none");
  });

  /**
   * Beyond the PRD's sixteen fields, on purpose. A row saying "approved"
   * without recording what was reviewed cannot be re-checked when the checker
   * learns about a new extension, or when the mint changes.
   */
  it("records what was reviewed, so an approval can be audited later", () => {
    const row = buildAssetRegistryRow({
      mint: mints.token_2022_pyusd.mint, account: mints.token_2022_pyusd.account,
      eligibility: report("token_2022_pyusd"), policy: POLICY, now: NOW,
      metadata: tokenMetadataFromMintAccount(mints.token_2022_pyusd.account),
    });
    expect(row.eligibility.overall).toBe("needs-review");
    expect(row.eligibility.unanswered).toBe(5);
    const ids = row.eligibility.hazards.map((h) => h.id);
    expect(ids).toContain("extensions");
    expect(JSON.stringify(row.eligibility.hazards)).toMatch(/permanentDelegate/);
    expect(row.transfer_fee_status).toBe("present");
    expect(row.symbol).toBe("PYUSD");
    expect(row.metadata_source).toBe("token-2022-extension");
  });

  /**
   * A registry makes statements about assets that change underneath it - a mint
   * authority can mint, a routing venue can stop routing. The threshold is the
   * caller's, because how long an approval stays good is policy too.
   */
  it("can tell a caller its review has gone stale", () => {
    const row = buildAssetRegistryRow({
      mint: mints.usdc.mint, account: mints.usdc.account,
      eligibility: report("usdc"), policy: POLICY, now: NOW,
    });
    const day = 86_400_000;
    expect(isStale(row, 7 * day, NOW().getTime() + day)).toBe(false);
    expect(isStale(row, 7 * day, NOW().getTime() + 8 * day)).toBe(true);
    // An unreadable date is not a fresh one.
    expect(isStale({ ...row, last_verified_at: "not a date" }, 7 * day)).toBe(true);
  });
});
