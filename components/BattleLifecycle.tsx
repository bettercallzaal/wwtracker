"use client";

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";
import { TREASURY_WALLET } from "@/lib/config";

// The program as a state machine rather than as six unrelated counters.
//
// Every battle walks the same path on-chain: createBattle, mint, then a trading
// window of buyShares and sellShares, then endBattle, then claimShares as
// traders withdraw. Laying the instructions out in that order turns the
// counters into a funnel, and the funnel's GAPS are the interesting part -
// battles created but never settled, and settled battles whose winnings nobody
// has come back for. Neither number appears on any WaveWarZ surface.

interface Day {
  date: string;
  txs: number;
  buys: number;
  sells: number;
  claims: number;
  created: number;
  settled: number;
  minted: number;
}

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function BattleLifecycle() {
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-onchain-daily.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Day[] | null) => alive && setDays(d))
      .catch(() => alive && setDays([]));
    return () => {
      alive = false;
    };
  }, []);

  const f = useMemo(() => {
    if (!days?.length) return null;
    const t = (k: keyof Day) => days.reduce((s, d) => s + (d[k] as number), 0);
    const created = t("created");
    const minted = t("minted");
    const buys = t("buys");
    const sells = t("sells");
    const settled = t("settled");
    const claims = t("claims");
    return {
      created,
      minted,
      trades: buys + sells,
      settled,
      claims,
      buys,
      sells,
      unsettled: created - settled,
      unminted: created - minted,
      tradesPerBattle: created ? (buys + sells) / created : 0,
      claimsPerSettled: settled ? claims / settled : 0,
      buysPerSell: sells ? buys / sells : 0,
    };
  }, [days]);

  // Signer concentration. The treasury wallet also signs battle creation and
  // settlement, so it dominates by design - but by how much is a fair question
  // and the answer is not obvious until you plot it.
  const conc = useMemo(() => {
    const rows = WW.traders ?? [];
    if (!rows.length) return null;
    const total = rows.reduce((s, r) => s + r.txs, 0);
    const share = (n: number) =>
      Math.round((100 * rows.slice(0, n).reduce((s, r) => s + r.txs, 0)) / total);
    return {
      total,
      top1: rows[0],
      top1IsTreasury: rows[0]?.trader === TREASURY_WALLET,
      top1Share: Math.round((100 * (rows[0]?.txs ?? 0)) / total),
      top5: share(5),
      top10: share(10),
    };
  }, []);

  if (!f) {
    return (
      <div style={panel}>
        <span style={metaLabel}>BATTLE LIFECYCLE</span>
        <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, marginTop: 10 }}>
          loading the decoded instruction series...
        </p>
      </div>
    );
  }

  // Battles and trades are different units. Putting 1,643 battles and 13,055
  // trades on one shared scale flattens every battle stage into an identical
  // stub, which is the same dual-axis mistake the overview chart avoids. So the
  // per-battle stages are scaled against createBattle - the population every
  // later stage is a subset of - and the trading window is drawn separately in
  // its own colour, scaled to itself, with the unit said out loud.
  const stages = [
    { k: "createBattle", n: f.created, unit: "battles", note: "a battle account opens" },
    { k: "mint", n: f.minted, unit: "battles", note: "its share tokens are created" },
    { k: "buy + sell", n: f.trades, unit: "trades", note: `${f.tradesPerBattle.toFixed(1)} trades per battle - different unit, own scale` },
    { k: "endBattle", n: f.settled, unit: "battles", note: "the winner is recorded on-chain" },
    { k: "claimShares", n: f.claims, unit: "calls", note: `${f.claimsPerSettled.toFixed(2)} per settled battle` },
  ];
  // claimShares can exceed createBattle (several claims per battle), so the
  // battle-unit scale is the larger of the two rather than created alone.
  const battleMax = Math.max(f.created, f.claims);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={panel}>
        <span style={metaLabel}>BATTLE LIFECYCLE - EVERY STAGE, DECODED ON-CHAIN</span>
        <p style={{ color: C.dim, fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 16px", maxWidth: "68ch" }}>
          Six instructions, in the order a battle actually walks them. The bars are
          all-time call counts from the program&apos;s first day. What matters is
          where they do not line up.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stages.map((s) => (
            <div key={s.k} style={{ display: "grid", gridTemplateColumns: "128px 1fr", gap: 12, alignItems: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: 12, color: C.text }}>{s.k}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      height: 18,
                      width: `${Math.max(2, (100 * s.n) / (s.unit === "trades" ? f.trades : battleMax))}%`,
                      background: s.unit === "trades" ? C.blue : C.accent,
                      opacity: 0.85,
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(s.n)}
                  </span>
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.dim, marginTop: 3 }}>{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12 }}>
        <Gap
          n={fmt(f.unsettled)}
          label="CREATED, NEVER SETTLED"
          note="battle accounts opened that no endBattle call ever closed. stuck, abandoned, or tests - either way they are still open on-chain."
          tone={C.blue}
        />
        <Gap
          n={f.claimsPerSettled.toFixed(2)}
          label="CLAIMS PER SETTLED BATTLE"
          note="traders withdraw manually, so a settled battle is not a paid-out one. the gap between settlement and claiming is money still sitting in vaults."
          tone={C.blue}
        />
        <Gap
          n={f.buysPerSell.toFixed(2)}
          label="BUYS PER SELL"
          note="people buy in and hold to settlement rather than trading out mid-battle. that is a position, not a trade."
          tone={C.accent}
        />
        <Gap
          n={fmt(f.unminted)}
          label="CREATED, NEVER MINTED"
          note="battles whose share tokens were never created. nothing could be traded on them."
          tone={C.blue}
        />
      </div>

      {conc && (
        <div style={panel}>
          <span style={metaLabel}>WHO ACTUALLY CALLS THE PROGRAM</span>
          <p style={{ color: C.dim, fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 14px", maxWidth: "68ch" }}>
            Signer concentration across the top {WW.traders.length} wallets by transaction
            count. The platform&apos;s own wallet signs every battle it creates and
            settles, so it leads by design - but the shape below is worth publishing
            rather than leaving people to guess at.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Gap n={`${conc.top1Share}%`} label="TOP WALLET" note={conc.top1IsTreasury ? "the platform treasury / ops wallet" : "single busiest signer"} tone={C.blue} />
            <Gap n={`${conc.top5}%`} label="TOP 5 WALLETS" note="share of all decoded program calls" tone={C.blue} />
            <Gap n={`${conc.top10}%`} label="TOP 10 WALLETS" note="share of all decoded program calls" tone={C.blue} />
            <Gap n={fmt(WW.program.uniqueTraders)} label="DISTINCT SIGNERS" note="wallets that have ever called the program" tone={C.accent} />
          </div>
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.grid}`,
  borderRadius: 16,
  padding: "16px 18px",
};

function Gap({ n, label, note, tone }: { n: string; label: string; note: string; tone: string }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {n}
      </div>
      <div style={{ ...metaLabel, marginTop: 6, fontSize: 10 }}>{label}</div>
      <p style={{ color: C.dim, fontSize: 12, lineHeight: 1.5, margin: "8px 0 0" }}>{note}</p>
    </div>
  );
}
