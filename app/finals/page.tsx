"use client";

/**
 * The live trading view: what is running, what a spend actually buys on each
 * side, and the three things the trading UI does not tell you.
 *
 * It computes quotes IN THE BROWSER from `lib/ww/quote`, the same module the
 * tests pin against 22 measured trades, so what this page shows and what the
 * SDK builds cannot drift apart. The only server call is discovery, because
 * that one needs the keyed endpoint.
 */
import { useEffect, useState } from "react";
import { quoteBuy, minimumSpendLamports, SUPPLY_QUANTUM } from "@/lib/ww/quote";

type Battle = {
  battleId: number; startTime: number; endTime: number;
  pool: { a: number; b: number }; supply: { a: number; b: number };
  winnerDecided: boolean; winnerArtistA: boolean;
};

const SOL = (l: number) => (l / 1e9).toFixed(6);
const N = (n: number) => Math.round(n).toLocaleString();

/** The cheapest spend that still mints the same whole number of steps. */
function cheapestForSameTokens(pool: number, spend: number): number {
  const target = quoteBuy(pool, spend).tokensOut;
  if (target <= 0) return spend;
  let lo = 1, hi = spend;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (quoteBuy(pool, mid).tokensOut >= target) hi = mid; else lo = mid + 1;
  }
  return lo;
}

function Side({ label, pool, supply, spend }: { label: string; pool: number; supply: number; spend: number }) {
  const q = quoteBuy(pool, spend);
  const cheapest = cheapestForSameTokens(pool, spend);
  const waste = spend - cheapest;
  const after = quoteBuy(pool + Math.round(spend * 0.985), 10_000_000).tokensOut / 0.01;
  const rate = q.tokensOut > 0 ? q.tokensOut / (spend / 1e9) : 0;
  return (
    <div style={{ border: "1px solid #24304a", borderRadius: 10, padding: 14, flex: 1, minWidth: 260 }}>
      <div style={{ fontWeight: 700, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
        pool {SOL(pool)} SOL · minted {N(supply)}
      </div>
      <div style={{ fontSize: 26, marginTop: 10, color: "#95fe7c" }}>{N(q.tokensOut)}</div>
      <div style={{ opacity: 0.7, fontSize: 13 }}>tokens for {SOL(spend)} SOL</div>
      <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.7 }}>
        <div>rate now <strong>{N(rate)}</strong> /SOL</div>
        <div>next buyer <strong>{N(after)}</strong> /SOL</div>
        {q.tokensOut <= 0 ? (
          <div style={{ color: "#ff9d9d" }}>
            mints NOTHING here — minimum is {SOL(minimumSpendLamports(pool))} SOL
          </div>
        ) : waste > 0 ? (
          <div style={{ color: "#ffd479" }}>
            same tokens for {SOL(cheapest)} SOL — {SOL(waste)} wasted past the step
          </div>
        ) : (
          <div style={{ opacity: 0.6 }}>lands on a step boundary</div>
        )}
      </div>
    </div>
  );
}

export default function Finals() {
  const [data, setData] = useState<{ live: Battle[]; awaitingSettlement: number; readAt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spendSol, setSpendSol] = useState("0.05");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        // ?battle=ID pins one battle regardless of phase. It exists so this
        // page's card rendering can be exercised when nothing is live - the
        // path that would otherwise run for the first time during a show - and
        // it is useful on its own for watching one battle through settlement.
        const pinned = new URLSearchParams(window.location.search).get("battle");
        const r = await fetch(pinned ? `/api/ww/live-battles?battle=${encodeURIComponent(pinned)}` : "/api/ww/live-battles", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (j.status !== "ok") { setErr(j.error ?? "discovery failed"); return; }
        setErr(null); setData(j);
      } catch (e) { if (alive) setErr(String(e)); }
    };
    pull();
    const a = setInterval(pull, 5000);
    const b = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { alive = false; clearInterval(a); clearInterval(b); };
  }, []);

  const spend = Math.max(1, Math.round(Number(spendSol || "0") * 1e9));
  const now = Math.floor(Date.now() / 1000);

  return (
    <main style={{ padding: 24, fontFamily: "var(--font-jetbrains-mono, monospace)", color: "#e8eefc", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>WaveWarZ live</h1>
      <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 18 }}>
        {err ? <span style={{ color: "#ff9d9d" }}>discovery error: {err}</span>
             : data ? `read ${new Date(data.readAt).toLocaleTimeString()} · ${data.awaitingSettlement} unsettled` : "loading"}
      </div>

      <label style={{ fontSize: 13, display: "block", marginBottom: 16 }}>
        spend{" "}
        <input value={spendSol} onChange={(e) => setSpendSol(e.target.value)} inputMode="decimal"
          style={{ background: "#0d1524", color: "#e8eefc", border: "1px solid #24304a", borderRadius: 6, padding: "4px 8px", width: 110, fontFamily: "inherit" }} />{" "}
        SOL
      </label>

      {data && data.live.length === 0 && (
        <div style={{ opacity: 0.6, fontSize: 14 }}>No battle running right now. This page refreshes itself.</div>
      )}

      {data?.live.map((b) => {
        const left = b.endTime - now;
        const lead = b.pool.a === b.pool.b ? "TIE — the program settles a tie to B"
          : b.pool.a > b.pool.b ? `A leads by ${SOL(b.pool.a - b.pool.b)} SOL` : `B leads by ${SOL(b.pool.b - b.pool.a)} SOL`;
        const qa = quoteBuy(b.pool.a, spend).tokensOut, qb = quoteBuy(b.pool.b, spend).tokensOut;
        return (
          <section key={b.battleId} style={{ marginBottom: 26, borderTop: "1px solid #1b2436", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <strong>{b.battleId}</strong>
              <span style={{ color: b.winnerDecided ? "#95fe7c" : left < 60 ? "#ffd479" : "#8fa4c9" }}>
                {/* SETTLED and AWAITING are different states and conflating them
                    is the expensive direction: a claim against an unsettled
                    battle returns BattleNotEnded. Checked, not assumed from the
                    clock. */}
                {b.winnerDecided
                  ? `SETTLED — winner ${b.winnerArtistA ? "A" : "B"}`
                  : left > 0
                    ? `${Math.floor(left / 60)}m ${String(left % 60).padStart(2, "0")}s left`
                    : "ended, NOT settled — a claim returns BattleNotEnded"}
              </span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, margin: "6px 0 12px" }}>
              settlement follows the larger pool — {lead}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Side label="ARTIST A" pool={b.pool.a} supply={b.supply.a} spend={spend} />
              <Side label="ARTIST B" pool={b.pool.b} supply={b.supply.b} spend={spend} />
            </div>
            {qa !== qb && (
              <div style={{ fontSize: 13, marginTop: 10, color: "#95fe7c" }}>
                the same SOL buys {N(Math.abs(qa - qb))} more on {qa > qb ? "A" : "B"} — the smaller pool is always the cheaper side
              </div>
            )}
          </section>
        );
      })}

      <footer style={{ marginTop: 30, fontSize: 12, opacity: 0.65, lineHeight: 1.8, borderTop: "1px solid #1b2436", paddingTop: 14 }}>
        <div>Tokens mint in whole steps of {N(SUPPLY_QUANTUM)}. Anything spent past a step buys nothing and you are not told.</div>
        <div>The curve is a square root, so every SOL already in a pool makes the next token dearer. Early money is worth more.</div>
        <div>Sells on the live client carry no slippage floor at all — 92 of 92 sampled. A sell takes whatever the pool did before it landed.</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>Quotes computed in this page from the same module the SDK uses, pinned against 22 trades measured on chain.</div>
      </footer>
    </main>
  );
}
