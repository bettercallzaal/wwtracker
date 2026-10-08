# WaveWarZ repos - the map

Every public WaveWarZ code repo, who owns it, what it is, and whether it is
alive. `SURFACES.md` says which **site** belongs to whom; this says which
**repo**.

**Measured 2026-10-08** with `gh api` (last commit on the default branch, open
PRs) and `curl` (HTTP status of the homepage). Every row is as of that date.
Private repos are not listed here; this repo is public.

## Live products

| Repo | Owner | What it is | Last commit | Homepage | Open PRs |
|---|---|---|---|---|---|
| `bettercallzaal/wwtracker` | Zaal | This repo. The on-chain business layer: treasury, fee model, ledger, decoded program | 2026-10-01 | wwtracker.vercel.app, 200 | 2 (#434 data refresh, #435 SOL price) |
| `CandyToyBox/wavewarz-intelligence` | Candy | wavewarz.info. Analytics, leaderboards, the public API. System of record for battle data | 2026-09-15 | wavewarz.info, 200 | 0 |
| `wavewarz/wavewarz-dj-wavy-api` | WaveWarZ org | Backend for the DJ Wavy audio judging pipeline | 2026-07-12 | wavewarz-dj-wavy-api.vercel.app, 200 | 0 |

`bettercallzaal/wavewarz-protocol` (private) holds the on-chain ground truth
these docs cite: chain snapshots, recon notes, and the scan tools. Its latest
snapshot, `data/chain-snapshot-2026-09-27`, landed 2026-10-08.

## Demos and side tools

| Repo | What it is | Last commit | Homepage | State |
|---|---|---|---|---|
| `bettercallzaal/wavewarzapp` | WaveWarZ Live: fan alert and spectator app | 2026-08-25 | wavewarzapp.vercel.app, 200 | Demo. Its README says "in-memory mock data. No real auth" |
| `bettercallzaal/wavewarz-overlay` | "Now battling" lower-third overlay for Restream/OBS | 2026-08-25 | wavewarz-overlay.vercel.app, 200 | Working tool |
| `bettercallzaal/wwbase` | Public brief for WaveWarZ on Base L2 | 2026-08-25 | none | Brief only, no product code |
| `CandyToyBox/wavewarz-base` | Base L2 battle contracts and app, Base Sepolia testnet | 2026-05-15 | wavewarz-base.vercel.app, 200 | Testnet. 2 open PRs, untouched since August: #9 (Zaal, entry queue, 2026-06-14), #10 (XTincT-io, 2026-08-10) |

## Old and archived

| Repo | What it was | Last commit | State |
|---|---|---|---|
| `bettercallzaal/WARZAI` | ElizaOS WaveWarZ AI bot | 2025-09-10 | Archived on GitHub |

## Where WaveWarZ work lives that is not code

- **Research and the why:** `docs/` in this repo (start at `README.md`), and
  `research/` in `bettercallzaal/ZAOOS`.
- **Operating procedures:** `docs/SOP.md` here.

## Keeping this current

Re-run the three commands below and update the rows that changed, with the date.
Do not rewrite a row without re-measuring it.

```
gh api "repos/<owner>/<repo>/commits?per_page=1" --jq '.[0].commit.author.date'
gh pr list -R <owner>/<repo> --state open
curl -s -o /dev/null -w '%{http_code}' https://<homepage>
```
