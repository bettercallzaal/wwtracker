# Moving work from the lab to production

wwtracker is the lab. `CandyToyBox/wavewarz-intelligence` (wavewarz.info) is
production. This is how a finished piece crosses over.

Written 2026-09-05, the day push access to that repo was granted. If you are
reading this much later, re-check their stack before trusting section 2 - it is
the part most likely to have moved.

---

## 1. Pick the route first

There are two ways to get wwtracker work onto wavewarz.info, and picking the
wrong one wastes a day.

| | Route A: embed the iframe | Route B: port the component |
|---|---|---|
| Effort | minutes | hours to a day |
| Their repo changes | one `<iframe>` | a real component + a data path |
| Who owns the data | us | them |
| Updates when we update | yes, automatically | no, it is a copy |
| Good for | charts, counters, anything self-contained | things that must match their design exactly or need their data |

**Default to Route A.** It is why the embed system exists. Framing is already
CSP-allowed for `wavewarz.info` and `wavewarz.com` (see `next.config.mjs`), the
widgets already wear their design tokens, and an embed keeps the data on our
side - which matters because the whole reason wwtracker exists is that a second
copy of a number drifts from the first.

Use Route B only when the piece genuinely belongs to them: something that needs
Supabase data we do not have, or that must sit inline in a page rather than in a
box.

---

## 2. Route A - embed

1. Pick the widget slug from `lib/embeds.ts` or the gallery at
   `https://wwtracker.vercel.app/embed`.
2. Copy the iframe snippet from the gallery. It already carries the right
   height, `loading="lazy"`, and a title.
3. Paste into the relevant page in their `src/app/`.
4. Add `?bare=1` if their page supplies its own heading, otherwise the title
   renders twice. Other params: `theme=light`, `transparent=1`, `accent=RRGGBB`.

That is the whole procedure. Nothing needs to change on our side.

If a widget does not exist yet, adding one is one entry in `lib/embeds.ts`, one
component in `components/embeds/Widgets.tsx`, and one line in the `WIDGETS` map.
Keep those three in agreement - `scripts/validate.mjs` does not check it yet, but
they were verified equal at 15 on 2026-09-05.

---

## 3. Route B - port the component

### 3.1 The two stacks differ in one important way

Both are Next.js App Router with React 18 and **recharts**, so chart code moves
across mostly intact. That is the good news and it is not an accident worth
relying on - check `package.json` on both sides before starting.

The difference that costs time: **wwtracker styles with inline `style={{}}`
objects reading tokens from `lib/theme.ts`. They style with Tailwind**, plus
`class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui`, `lucide-react`
and `shadcn`.

So a ported component needs its inline styles rewritten as Tailwind classes. The
values do not change - `lib/theme.ts` holds their design tokens verbatim from
the design-system doc in **their** repo - only the mechanism does.

### 3.2 Checklist

- [ ] Rewrite inline styles as Tailwind. Colours map straight across; the token
      values in `lib/theme.ts` came from their design system in the first place.
- [ ] Decide where the data comes from. Ours is Dune snapshots in `public/*.json`
      plus their public API. Theirs is Supabase. If the component reads a
      wwtracker snapshot, either keep reading our API (which makes it Route A
      with extra steps - reconsider) or add a Supabase-backed equivalent.
- [ ] Keep the provenance line. Every wwtracker component says where its number
      came from. Do not drop that on the way over; it is the habit that keeps
      the two sites from disagreeing.
- [ ] Keep the "model, not measurement" language where it exists. The settlement
      waterfall and skip ladder in `components/FeeModel.tsx` are the fee
      **schedule** applied to a hypothetical pool, not measured on-chain flows.
      That distinction must survive the port.
- [ ] Branch, PR, and let them review. Push access is not a reason to push to
      their `main`.

### 3.3 What is already portable

- `lib/feeModel.ts` - pure functions, no React, 31 tests, no dependencies.
  Drops in as-is.
- `lib/wavewarzApi.ts` - a typed client for their own public API. Useful to them
  mostly as documentation of their own response shapes and the gotchas in
  `docs/PUBLIC-API.md`.
- The Dune query set in `scripts/ww-gen.mjs` - they index with Helius rather
  than Dune, so this is additive rather than a replacement. The treasury series
  and the decoded instruction mix are things their pipeline does not produce.

---

## 4. What should probably move, and in what order

From `docs/AUDIT.md` section 4, filtered to things that belong on their site
rather than ours:

1. **The four missing API endpoints** (audit 4.3). Community rankings, clipper
   rankings, Benefits charity totals, and a Heat field. These are Route B by
   definition - the data is in their Supabase, not ours. Now that push access
   exists this is a PR to their repo rather than a request, and it unblocks
   three more embed widgets on our side.
2. **The treasury and floor charts** (Route A). Nothing on wavewarz.info shows
   the platform's own balance against its operating floor. Highest-value embed.
3. **The fee model section** (Route A or B). The story that artists take 1.0%
   against the platform's 0.5% on every trade is theirs to tell and nobody is
   telling it. Route A works; Route B is better if they want it inline on a
   page about artist earnings.
4. **The battle lifecycle funnel** (Route A). The gaps - battles created but
   never settled, claims lagging settlements - are operationally useful to them
   and invisible today.

---

## 5. Rules that do not bend

- **Do not open speculative PRs against production.** Prove it here first.
- **Do not copy their data into wwtracker.** That rule is why this repo exists
  in its current form; see `docs/AUDIT.md` section 1 for what it cost when it
  was broken.
- **Do not let a number cross without its provenance line.** A figure with no
  stated source is how two sites start disagreeing without anyone noticing.
