# WaveWarZ - Research & On-Chain Analytics

Living research doc for the wwtracker project. Product/qualitative notes plus
on-chain findings from Dune. Last updated: 2026-07-16.

Spelling is always **WaveWarZ** (capital W, capital Z).

---

## 1. What WaveWarZ is

A decentralized music-battle platform on Solana. Artists compete song-vs-song;
fans trade SOL on the outcomes. Everything settles in native SOL - there is no
WaveWarZ platform token. Each battle spins up two ephemeral per-artist SPL token
mints (Artist A / Artist B) on a bonding curve; traders buy the side they think
will win and claim winnings after settlement.

- Winner = best 2 of 3: **Poll** (community vote) + **Charts** (SOL volume) +
  **DJ Wavy** (AI judge).
- Formats: **Quick Battles** (nightly) and **Main Events** (catalog vs catalog,
  tournament brackets).
- Trader winnings are **claimed manually**; artist payouts settle automatically.
- Live programming: streams Mon-Fri ~8:30 PM EST on X Spaces / YouTube.

Part of the **BCZ -> ZAO -> WaveWarZ** ecosystem (WaveWarZ is the music-battle
application layer of The ZAO). **ZAO = ZTalent Artist Organization** — a
community-driven hub for musicians, artists, and technologists in web3, part of
the ZTalent Network. (Source: thezao.com/about, verified 2026-07-16.)

Programming & tournaments (verified, wavewarz.info): Quick Battles weeknights
~8:30 PM EST (30-second final trading window); Community AMAs Mon-Fri ~11 AM EST;
on X Spaces + YouTube. Two brackets: a 16-artist single-elimination Artist
Tournament (instant SOL payouts per round) and an AI Artist Tournament
(AI-generated tracks, community-voted). All-time battle types (snapshot 2026-07-16):
**1,042 quick battles + 162 main-event battles across 50 main events = 1,240 total**
(vs 1,127 on-chain initializeBattle - different definitions). Verified artist: XTinct
(Alejandro Estrella). NOTE: dopestilo/"No Regrets", Ramone/"Stupid MFs", Visionz vs
Rome were NOT verifiable - left out of the app.

## 2. Team

- **Ikechi Nwachukwu (hurric4n3ike)** - founder / lead developer (the on-chain
  program lives in his `wavewagerz` repo). Also an artist ("No Regrets").
- **Zaal Panthaki (BetterCallZaal)** - cofounder, head of ecosystem, backend.
  Founder of The ZAO.
- **candy / CandyToyBox (Samantha Kinney)** - design, promo, marketing; built the
  reference analytics apps.

## 3. Traction (reported, Jul 2026)

- ~521.75 SOL total volume, ~1,241 battles (1,043 quick + 162 main-event + 36 community), ~9.05 SOL artist payouts, ~17.38 SOL platform revenue. **127.34 SOL claimed by traders** (939 claimShares withdrawals). (snapshot 2026-07-17, wavewarz.info/api/public/stats)
- On-chain (Dune, this project): program active since **2025-08-01**; see section 6. (Dune snapshot 2026-06-14)

---

## 4. On-chain program model

Program ID (CONFIRMED): **`9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`**
Solscan: https://solscan.io/account/9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo

Source of truth: IDL in the private repo `hurric4n3ike/wavewagerz`
(`idl/wavewarzvtwo.json`). Discriminators below are **VERIFIED on-chain** - a
Dune decode (`to_hex(bytearray_substring(data,1,8))`) over the program's
instruction_calls matched all six cleanly with the counts in section 6.

### Instructions (8-byte Anchor discriminators)

| Instruction | Discriminator | Purpose |
|---|---|---|
| initializeBattle | `[117,108,166,159,146,82,246,223]` | Create battle, vault, mints |
| initializeMints | `[189,84,85,142,177,200,57,22]` | Create Artist A/B SPL mints (PDAs) |
| buyShares | `[40,239,138,154,8,37,106,108]` | Buy a side on the bonding curve (a "bet") |
| sellShares | `[184,164,169,16,231,158,199,196]` | Sell back for SOL before settlement |
| endBattle | `[80,145,208,48,183,92,168,112]` | Settle, distribute loser pool |
| claimShares | `[130,131,29,237,134,20,110,245]` | Withdraw winnings after settlement |

To classify a wallet's WaveWarZ activity on Dune: filter
`solana.instruction_calls` by `executing_account = <program>`, then match the
first 8 bytes of the instruction `data` to the table above (buyShares /
sellShares = trading; claimShares = winnings out).

### Battle account (state)

Per-battle PDA, seeds `["battle", battle_id (u64 LE)]`. Holds: battle_id,
start/end time (unix s), artist_a/b wallet, wavewarz_wallet (platform treasury),
artist_a/b mint, per-side supply, per-side SOL balance/pool, winner flags,
total_distribution_amount, admin. Vault PDA seeds `["battle_vault", battle_id]`
holds the SOL pools. Pools are u64 lamports (/1e9 for SOL).

### Fees and settlement (per IDL/agent; verify on-chain)

Per trade (buyShares/sellShares): **artist 1.0%**, **platform 0.5%**, ~98.5%
stays in the bonding-curve pool.

At settlement (endBattle), the **loser pool** is split:

| Recipient | Share of loser pool |
|---|---|
| Winning traders (pro-rata) | 40% |
| Losing traders (capital refund) | 50% |
| Winning artist | 5% |
| Losing artist | 2% |
| Platform treasury | 3% |

Trader payout (claimShares):
- Winning side: `(tokens/winner_supply) * winner_pool + (tokens/winner_supply) * loser_pool*0.40`
- Losing side: `(tokens/loser_supply) * loser_pool*0.50`
- ROI = (payout - invested) / invested.

So platform revenue = 0.5% of every trade + 3% of every loser pool. That is what
funds the dev/treasury wallet and its ~3.5 SOL operating floor.

### Data access (how candy's apps read it)

- Helius RPC: `https://mainnet.helius-rpc.com/?api-key=...` and enhanced tx API
  `https://api-mainnet.helius-rpc.com/v0/addresses/{addr}/transactions` (the old
  `api.helius.xyz` host 403s).
- `getAccountInfo(battlePDA)` -> parse the Battle struct for pools/winner.
- Volume from battleVault tx history filtered by buyShares/sellShares.
- A Supabase Postgres mirror (`battles`, `trades`, `artists`, `leaderboards`)
  backs the chain reads. Note: volume for battles settled before 2026-04-27 was
  backfilled and may be off in early snapshots.

---

## 5. Key addresses

| Role | Address | Notes |
|------|---------|-------|
| WaveWarZ program | `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo` | Confirmed (515 trader calls Sep'25-Jun'26). |
| Platform treasury / dev wallet | `FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37` | `wavewarz_wallet`; the 3.5 floor. |
| Zaal trader wallet | `4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk` | -1.6493 SOL, -30.67% ROI, 1000 battles. |
| Artist wallets / mints | per-battle | Set in initializeBattle; PDAs for mints. |

## 6. On-chain analytics (Dune)

Tables: `solana.instruction_calls` (tx_signer, executing_account, data),
`solana.account_activity` (address, balance_change, post_balance). Free tier: keep
scans bounded by `block_date` / `executing_account`. Snapshot baked into the app
via `lib/wwData.ts`; regenerate by re-running `scripts/ww-research.sh`.

Datasets (from program `9TUf`, since 2025-08-01; snapshot 2026-06-14):

**Platform (program 9TUf), instruction decode (since 2025-08-01):**
- initializeBattle 1,127 (battles created) / endBattle 1,110 (settled) -> ~17
  in-flight. Matches the reported ~1,073 battles.
- buyShares 6,914 + sellShares 2,131 = 9,045 trades; claimShares 2,299.
- **122 unique traders** (distinct buyShares signers) - the real trader count.

**Platform buy volume:** 324.62 SOL committed by traders on buyShares txs (peak
28.44 SOL on 2026-03-02). Buy-side only; wavewarz-intelligence reports 521.75 SOL total
(both sides) - same ballpark. (Per-trader volume leaderboard query times out on
the free tier - deferred.)

**Platform (program 9TUf):**
- 14,681 program txs across 230 active days (2025-08-01 -> 2026-06-13).
- Treasury (`FNj`) lifetime: 50.57 SOL in / 47.06 SOL out / **net +3.51 SOL** -
  which lands exactly on the ~3.5 operating floor. Strong confirmation that `FNj`
  is the `wavewarz_wallet` and the floor model is real.
- Top raw tx signer is the treasury itself (5,022 txs - it signs every battle),
  so it is excluded from the trader leaderboard.

**Zaal trader (`4aY1`):**
- 518 WaveWarZ txs. 18.02 SOL bet out, 15.06 SOL returned -> **net -2.96 SOL**
  on-chain (every WaveWarZ tx's SOL delta, includes fees).
- Win rate 35.7% (185 positive-delta txs / 333 negative). Biggest single win
  +0.60 SOL, biggest single loss -0.90 SOL.
- Note the divergence from the stats app's realized PnL (-1.6493 SOL / -30.67%):
  the app nets settled positions per battle, while our figure is raw net SOL
  flow across all WaveWarZ txs. The ~1.3 SOL gap = open/unclaimed positions +
  methodology. Both are shown in the My Trades tab.

Figures live in `lib/wwData.ts` and the app's Analytics + My Trades tabs.

## 6b. Methodology (how each number is derived)

- **Treasury balance / floor**: `solana.account_activity` for `FNj`,
  `max_by(post_balance, block_time)` per day = close, `max(post_balance)` = the
  intraday high. Gap-filled forward.
- **Instruction mix (battles / trades / claims)**: decode the 8-byte Anchor
  discriminator via `to_hex(bytearray_substring(data,1,8))` on the program's
  `instruction_calls`, mapped to the IDL names. Verified - all six matched.
- **Trader PnL (flow-based)**: every WaveWarZ tx the wallet signs, take its net
  `balance_change` on `account_activity`. Negative = SOL committed (bets+fees),
  positive = SOL back (sells/claims). Cumulative sum = realized net SOL.
  Win rate = share of positive-delta txs. Honest and methodology-independent of
  the bonding-curve math; differs from the stats app's per-battle realized PnL.
- **Platform buy volume**: join `account_activity` (signer's negative delta) to
  the set of `buyShares` txs by `tx_id` + `tx_signer`. Sum = SOL committed on
  buys (includes ~1.5% fees + gas). Approximates the Charts-score volume.
- **Monthly PnL**: the same per-tx deltas, grouped by month.

All figures are a point-in-time snapshot (`lib/wwData.ts.generatedAt`); refresh
with `scripts/ww-research.sh` then `scripts/ww-gen.py`.

## 6c. Audius integration (music side)

WaveWarZ artists publish on **Audius** (free public API, no key, CORS-ok). The
app pulls live followers / tracks / play counts / artwork from
`https://api.audius.co` (resolve a discovery node from `/`, then
`/v1/users/{id}`, `/v1/users/{id}/tracks`, `/v1/tracks?id=...`,
`/v1/tracks/search`, `/v1/users/search` with `app_name=wwtracker`).

Verified artist -> Audius id (handle + catalog match):
- GodclouD -> `Vg1rWzQ`
- BennyJ504WaveWarz -> `RGyPJRg`
- RoCkY2GriMeY -> `aNYwwmo`
- _0xQuan -> no confident match (excluded)

Verified charting-song -> Audius track:
- "Fuck yo feelingZ" -> `0X6BQ99` (/GodclouD/fuck-yo-feelingz)
- "What the: Unreleased" -> `dY4Q23y` (/BennyJ504WaveWarz/what-the-unreleased)
- "EAZE OF MIND" -> `mE6RMV5` (/GodclouD/eaze-of-mind)
- "High Frequency with PKMN" -> `mWpBmxQ` (/RoCkY2GriMeY/high-frequency-with-pkmn)
- "ACCELERATE" -> no confident match (excluded)

Also confirmed: Hurric4n3Ike (founder, `lzq2G`, 48 tracks), NDA_WaveWarz
(`oGZ6o3J`). Combined across the 5 confirmed artists (live): ~106 tracks, ~1,666
plays, ~1,002 favs; genres Hip-Hop/Rap 82, R&B/Soul 20, Latin 2, Rock 2. The
founder's "...Wavez x Hurric4n3Ike" series tops plays (CreWavez 93). The Music
tab computes this live; held PKMN/IamThanos/Nessy (RoCkY collaborators, not
confirmed WaveWarZ battlers).

Rule: never display an Audius match that isn't confirmed by handle+title.

## 7. Open questions / next

- Decode buyShares vs claimShares per battle for true per-battle PnL + win rate.
- Trace artist payout flows (5%/2% + 1% per trade) to artist wallets.
- Identify the ops-budget wallet and quantify the weekly skim off the 3.5 floor.
- Confirm the fee/settlement percentages against a real settled battle's vault.

## Sources

- wavewarz.com, wavewarz.info, x.com/WaveWarZ, youtube.com/@WaveWarZ
- Program: github.com/hurric4n3ike/wavewagerz (IDL); apps:
  github.com/CandyToyBox/wavewarz-intelligence, /analytics-wave-warz
- Dune (this project), Solscan.
