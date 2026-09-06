"use client";

// The view you keep open while a battle runs.
//
// Everything here comes from Solana, not from wavewarz.info - the two artist-side
// mints are PDAs derived from the battle id, so the holder set is public and is
// not currently surfaced anywhere. That is the whole reason this page exists.
//
// The honesty rule this page inherits: an RPC failure must never render as "no
// holders", because that looks identical to a battle nobody traded. When the API
// returns `unknown`, this says so rather than drawing an empty board.

import { useCallback, useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface Holder {
  owner: string;
  amount: number;
  share: number;
  sol: number;
}

interface Positions {
  battleId: number;
  running: boolean;
  startTime: number;
  endTime: number;
  creator: string;
  poolASol: number;
  poolBSol: number;
  potSol: number;
  supplyA: number;
  supplyB: number;
  heldA: number;
  heldB: number;
  settled: boolean;
  marketWinnerIsA: boolean;
  totalDistributionSol: number;
  impliedIfAWins: number;
  impliedIfBWins: number;
  multipleIfAWins: number;
  multipleIfBWins: number;
  holdersA: Holder[];
  holdersB: Holder[];
}

interface Payload {
  status: "live" | "stale" | "unknown";
  data: Positions | null;
  note?: string;
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const sol = (n: number) => `${n.toFixed(4)} SOL`;

function useCountdown(endTime: number | undefined): string {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endTime) return "";
  const left = endTime - now;
  if (left <= 0) return "ended";
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SideBar({ a, b }: { a: number; b: number }) {
  const total = a + b;
  const pctA = total > 0 ? (a / total) * 100 : 50;
  return (
    <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.elev }}>
      <div style={{ width: `${pctA}%`, background: C.accent }} />
      <div style={{ width: `${100 - pctA}%`, background: C.blue }} />
    </div>
  );
}

function HolderTable({ holders, supply, held, color, label }: {
  holders: Holder[]; supply: number; held: number; color: string; label: string;
}) {
  return (
    <div style={{ background: C.panel, borderRadius: 12, padding: 16, flex: 1, minWidth: 300 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
        <strong style={{ color: C.text }}>{label}</strong>
        <span style={{ ...metaLabel, color: C.dim }}>
          {holders.length} holder{holders.length === 1 ? "" : "s"}
        </span>
      </div>
      {held < supply && supply > 0 && (
        <p style={{ ...metaLabel, color: C.dim, margin: "0 0 10px" }}>
          {(((supply - held) / supply) * 100).toFixed(0)}% of supply already claimed and burned
        </p>
      )}
      {holders.length === 0 ? (
        <p style={{ color: C.dim, fontSize: 13 }}>No open positions on this side.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" }}>
              <th style={{ fontWeight: 500, paddingBottom: 6 }}>Wallet</th>
              <th style={{ fontWeight: 500, textAlign: "right" }}>Share</th>
              <th style={{ fontWeight: 500, textAlign: "right" }}>Stake</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {holders.map((h) => (
              <tr key={h.owner} style={{ borderTop: `1px solid ${C.grid}` }}>
                <td style={{ padding: "6px 0", fontFamily: "C.mono", color: C.text }}>
                  {short(h.owner)}
                </td>
                <td style={{ textAlign: "right", color: C.text }}>{(h.share * 100).toFixed(1)}%</td>
                <td style={{ textAlign: "right", color: C.dim }}>{h.sol.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function LiveBattlePositions() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ww/positions", { cache: "no-store" });
      setPayload(await res.json());
    } catch {
      setPayload({ status: "unknown", data: null, note: "could not reach the tracker" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const d = payload?.data ?? null;
  const countdown = useCountdown(d?.running ? d.endTime : undefined);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px 64px", color: C.text }}>
      <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0.4 }}>LIVE BATTLE POSITIONS</h1>
      <p style={{ color: C.dim, marginTop: 6, maxWidth: 640 }}>
        Who holds what, on which side, read straight from Solana. The two artist-side
        mints are addresses derived from the battle id, so this is public data that
        nothing else currently shows.
      </p>

      {loading && <p style={{ color: C.dim }}>Reading the chain…</p>}

      {!loading && payload?.status === "unknown" && (
        <div style={{ background: C.panel, borderRadius: 12, padding: 20, marginTop: 20 }}>
          <strong>No reading available.</strong>
          <p style={{ color: C.dim, marginBottom: 0 }}>
            The chain read did not come back{payload.note ? `: ${payload.note}` : ""}. This is
            deliberately not shown as an empty battle, because a failed read and a
            battle nobody traded look identical and only one of them is true.
          </p>
        </div>
      )}

      {d && (
        <>
          <div style={{ background: C.panel, borderRadius: 12, padding: 20, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ ...metaLabel, color: C.dim }}>Battle</span>
                <div style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{d.battleId}</div>
              </div>
              <div>
                <span style={{ ...metaLabel, color: C.dim }}>Pot</span>
                <div style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{sol(d.potSol)}</div>
              </div>
              <div>
                <span style={{ ...metaLabel, color: C.dim }}>State</span>
                <div style={{ fontSize: 20, color: d.running ? C.accent : C.dim }}>
                  {d.running ? `RUNNING ${countdown}` : "SETTLED"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <SideBar a={d.poolASol} b={d.poolBSol} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
                <span style={{ color: C.accent }}>A {sol(d.poolASol)}</span>
                <span style={{ color: C.blue }}>B {sol(d.poolBSol)}</span>
              </div>
            </div>

            {d.running ? (
              <p style={{ color: C.dim, fontSize: 13, marginTop: 14, marginBottom: 0 }}>
                If A wins, that side shares {sol(d.impliedIfAWins)} ({d.multipleIfAWins.toFixed(2)}x
                stake). If B wins, {sol(d.impliedIfBWins)} ({d.multipleIfBWins.toFixed(2)}x). Using the
                settlement formula measured across 1,506 of 1,506 settled battles: the winning side takes
                its own pool plus 40% of the other.
              </p>
            ) : (
              <p style={{ color: C.dim, fontSize: 13, marginTop: 14, marginBottom: 0 }}>
                Market winner was side {d.marketWinnerIsA ? "A" : "B"} - the larger pool, which is what
                the program settles to. The judged result can differ and often does.
                Distributed {sol(d.totalDistributionSol)} to the winning side.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <HolderTable holders={d.holdersA} supply={d.supplyA} held={d.heldA} color={C.accent} label="SIDE A" />
            <HolderTable holders={d.holdersB} supply={d.supplyB} held={d.heldB} color={C.blue} label="SIDE B" />
          </div>

          <p style={{ ...metaLabel, color: C.dim, marginTop: 18 }}>
            Top holders per side, refreshed every 20 seconds. Wallets are addresses; this page
            never publishes an identity.
          </p>
        </>
      )}
    </main>
  );
}
