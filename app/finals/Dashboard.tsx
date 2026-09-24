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

type Check = { name: string; ok: boolean; detail: string };
type Health = { checks: Check[]; pass: number; fail: number; endpoint: string; keyed: boolean; live: number; awaitingSettlement: number; readAt: string };

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
    <div className="ww-side" style={{ border: "1px solid #24304a", borderRadius: 10, padding: 14 }}>
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
            mints NOTHING here - minimum is {SOL(minimumSpendLamports(pool))} SOL
          </div>
        ) : waste > 0 ? (
          <div style={{ color: "#ffd479" }}>
            same tokens for {SOL(cheapest)} SOL - {SOL(waste)} wasted past the step
          </div>
        ) : (
          <div style={{ opacity: 0.6 }}>lands on a step boundary</div>
        )}
      </div>
    </div>
  );
}

function Explained({ data }: { data: Record<string, unknown> }) {
  // A bare error code lookup comes back without a signature.
  if (!data.signature) {
    return (
      <>
        <div><strong>{String(data.code)}</strong> {data.name ? <span style={{ color: "#ffd479" }}>{String(data.name)}</span> : null}</div>
        <div style={{ opacity: 0.85 }}>{String(data.message)}</div>
        {data.advice ? <div style={{ marginTop: 8 }}>{String(data.advice)}</div> : null}
        {data.observed ? <div style={{ marginTop: 8, opacity: 0.6 }}>seen before: {String(data.observed)}</div> : null}
      </>
    );
  }
  const ixs = (data.instructions ?? []) as Record<string, unknown>[];
  const err = data.error as Record<string, unknown> | null;
  return (
    <>
      <div style={{ opacity: 0.6 }}>slot {String(data.slot)} · {String(data.blockTime ?? "")}</div>
      <div style={{ margin: "8px 0", color: data.failed ? "#ff9d9d" : "#95fe7c" }}>
        {data.failed ? "FAILED" : "SUCCEEDED"}
      </div>
      {ixs.map((ix) => (
        <div key={String(ix.index)} style={{ opacity: 0.9 }}>
          [{String(ix.index)}] {String(ix.name)}
          {ix.amount !== undefined ? ` · amount ${Number(ix.amount).toLocaleString()} · side ${String(ix.side)} · floor ${Number(ix.slippageFloor).toLocaleString()}` : ""}
          {ix.warning ? <span style={{ color: "#ffd479" }}> · {String(ix.warning)}</span> : null}
        </div>
      ))}
      {err ? (
        <div style={{ marginTop: 10 }}>
          <div><strong style={{ color: "#ffd479" }}>{String(err.name ?? "")}</strong> ({String(err.code)}) on instruction {String(err.instructionIndex)}</div>
          <div style={{ opacity: 0.85 }}>{String(err.message)}</div>
          {err.advice ? <div style={{ marginTop: 6 }}>{String(err.advice)}</div> : null}
        </div>
      ) : null}
      {Array.isArray(data.programLogs) && data.programLogs.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", opacity: 0.7 }}>the program's own log</summary>
          <pre style={{ whiteSpace: "pre-wrap", opacity: 0.75, fontSize: 12 }}>{(data.programLogs as string[]).join("\n")}</pre>
        </details>
      ) : null}
    </>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<{ live: Battle[]; awaitingSettlement: number; readAt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [spendSol, setSpendSol] = useState("0.05");
  /**
   * A one-second re-render, not a number anybody reads.
   *
   * The countdowns below recompute from `Date.now()` on every render, so what
   * this drives is the render itself; the value is never used. That makes it
   * indistinguishable from state nothing renders - the `errorMsg` shape - so
   * it is named in the allowance list of `lib/__tests__/stateIsRendered.test.ts`
   * rather than left to look like an oversight.
   */
  const [tick, setTick] = useState(0);
  // The buttons. Nothing here needs a terminal.
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sig, setSig] = useState("");
  const [explained, setExplained] = useState<Record<string, unknown> | null>(null);

  const runHealth = async () => {
    setBusy("health"); setExplained(null);
    try {
      const r = await fetch("/api/ww/diagnose", { cache: "no-store" });
      setHealth(await r.json());
    } catch (e) { setHealth(null); setErr(String(e)); } finally { setBusy(null); }
  };
  const runExplain = async () => {
    const q = sig.trim();
    if (!q) return;
    setBusy("explain"); setHealth(null);
    try {
      const url = /^\d{3,5}$/.test(q) ? `/api/ww/diagnose?code=${q}` : `/api/ww/diagnose?sig=${encodeURIComponent(q)}`;
      const r = await fetch(url, { cache: "no-store" });
      setExplained(await r.json());
    } catch (e) { setExplained({ status: "error", error: String(e) }); } finally { setBusy(null); }
  };

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
    <main className="ww-finals" style={{ fontFamily: "var(--font-jetbrains-mono, monospace)", color: "#e8eefc", maxWidth: 1000, margin: "0 auto" }}>
      {/* Phone first. Checked at 390px: the cards, the signature box and the
          long number lines all overflowed the right edge before this. */}
      <style>{`
        .ww-finals { padding: 16px; overflow-x: hidden; }
        .ww-finals * { min-width: 0; overflow-wrap: anywhere; }
        .ww-finals .ww-side { flex: 1 1 260px; }
        .ww-finals .ww-sig { flex: 1 1 100%; }
        @media (min-width: 620px) {
          .ww-finals { padding: 24px; }
          .ww-finals .ww-sig { flex: 1 1 250px; }
        }
      `}</style>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>WaveWarZ live</h1>
      <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 18 }}>
        {err ? <span style={{ color: "#ff9d9d" }}>discovery error: {err}</span>
             : data ? `read ${new Date(data.readAt).toLocaleTimeString()} · ${data.awaitingSettlement} unsettled` : "loading"}
      </div>

      {/* A LABEL THAT SURVIVES TYPING. The placeholder vanished on the first
          keystroke and the two boxes became indistinguishable - the first
          person to use this put an error code in the spend box. */}
      <label style={{ fontSize: 12, display: "block", marginBottom: 16, opacity: 0.85 }}>
        <span style={{ display: "block", marginBottom: 4, opacity: 0.7 }}>how much SOL you would trade</span>
        <input value={spendSol} onChange={(e) => setSpendSol(e.target.value)} inputMode="decimal"
          style={{ background: "#0d1524", color: "#e8eefc", border: "1px solid #24304a", borderRadius: 6, padding: "6px 9px", width: 120, fontFamily: "inherit", fontSize: 14 }} />
        <span style={{ marginLeft: 6 }}>SOL</span>
        {Number(spendSol) > 100 ? (
          <span style={{ color: "#ffd479", marginLeft: 10 }}>
            that is {Number(spendSol).toLocaleString()} SOL - did you mean the box below?
          </span>
        ) : null}
      </label>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>check the tools, or look up a failure</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <button onClick={runHealth} disabled={busy !== null}
          style={{ background: "#16233a", color: "#e8eefc", border: "1px solid #2b3b5a", borderRadius: 7, padding: "7px 13px", cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
          {busy === "health" ? "checking..." : "Check everything"}
        </button>
        <input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="paste a failed signature, or an error code"
          className="ww-sig" style={{ background: "#0d1524", color: "#e8eefc", border: "1px solid #24304a", borderRadius: 7, padding: "7px 10px", fontFamily: "inherit", fontSize: 13 }} />
        <button onClick={runExplain} disabled={busy !== null || !sig.trim()}
          style={{ background: "#16233a", color: "#e8eefc", border: "1px solid #2b3b5a", borderRadius: 7, padding: "7px 13px", cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
          {busy === "explain" ? "reading..." : "Why did it fail?"}
        </button>
      </div>

      {health && (
        <div style={{ border: "1px solid #24304a", borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: health.fail ? "#ff9d9d" : "#95fe7c" }}>{health.pass} pass, {health.fail} fail</strong>
            <span style={{ opacity: 0.6 }}> · {health.keyed ? "keyed endpoint" : "public endpoint, no fallback exists"} · {health.live} live, {health.awaitingSettlement} unsettled</span>
          </div>
          {health.checks.map((c) => (
            <div key={c.name} style={{ lineHeight: 1.8 }}>
              <span style={{ color: c.ok ? "#95fe7c" : "#ff9d9d" }}>{c.ok ? "PASS" : "FAIL"}</span>{" "}
              <span style={{ opacity: 0.9 }}>{c.name}</span>{" "}
              <span style={{ opacity: 0.55 }}>{c.detail}</span>
            </div>
          ))}
        </div>
      )}

      {explained && (
        <div style={{ border: "1px solid #24304a", borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 13, lineHeight: 1.7 }}>
          {explained.status === "error" ? (
            <div style={{ color: "#ff9d9d" }}>{String(explained.error)}</div>
          ) : (
            <Explained data={explained} />
          )}
        </div>
      )}

      {data && data.live.length === 0 && (
        <div style={{ opacity: 0.6, fontSize: 14 }}>No battle running right now. This page refreshes itself.</div>
      )}

      {data?.live.map((b) => {
        const left = b.endTime - now;
        const lead = b.pool.a === b.pool.b ? "TIE - the program settles a tie to B"
          : b.pool.a > b.pool.b ? `A leads by ${SOL(b.pool.a - b.pool.b)} SOL` : `B leads by ${SOL(b.pool.b - b.pool.a)} SOL`;
        const qa = quoteBuy(b.pool.a, spend).tokensOut, qb = quoteBuy(b.pool.b, spend).tokensOut;
        return (
          <section key={b.battleId} style={{ marginBottom: 26, borderTop: "1px solid #1b2436", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: 14 }}>
              <strong>{b.battleId}</strong>
              <span style={{ color: b.winnerDecided ? "#95fe7c" : left < 60 ? "#ffd479" : "#8fa4c9" }}>
                {/* SETTLED and AWAITING are different states and conflating them
                    is the expensive direction: a claim against an unsettled
                    battle returns BattleNotEnded. Checked, not assumed from the
                    clock. */}
                {b.winnerDecided
                  ? `SETTLED - winner ${b.winnerArtistA ? "A" : "B"}`
                  : left > 0
                    ? `${Math.floor(left / 60)}m ${String(left % 60).padStart(2, "0")}s left`
                    : "ended, NOT settled - a claim returns BattleNotEnded"}
              </span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, margin: "6px 0 12px" }}>
              settlement follows the larger pool - {lead}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Side label="ARTIST A" pool={b.pool.a} supply={b.supply.a} spend={spend} />
              <Side label="ARTIST B" pool={b.pool.b} supply={b.supply.b} spend={spend} />
            </div>
            {qa !== qb && (
              <div style={{ fontSize: 13, marginTop: 10, color: "#95fe7c" }}>
                the same SOL buys {N(Math.abs(qa - qb))} more on {qa > qb ? "A" : "B"} - the smaller pool is always the cheaper side
              </div>
            )}
          </section>
        );
      })}

      <footer style={{ marginTop: 30, fontSize: 12, opacity: 0.65, lineHeight: 1.8, borderTop: "1px solid #1b2436", paddingTop: 14 }}>
        <div>Tokens mint in whole steps of {N(SUPPLY_QUANTUM)}. Anything spent past a step buys nothing and you are not told.</div>
        <div>The curve is a square root, so every SOL already in a pool makes the next token dearer. Early money is worth more.</div>
        <div>Sells on the live client carry no slippage floor at all - 92 of 92 sampled. A sell takes whatever the pool did before it landed.</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>Quotes computed in this page from the same module the SDK uses, pinned against 22 trades measured on chain.</div>
      </footer>
    </main>
  );
}
