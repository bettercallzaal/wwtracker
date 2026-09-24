"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import BattleClock from "@/components/BattleClock";
import PoolChart from "@/components/PoolChart";
import TradeWidget from "@/components/TradeWidget";
import ClaimPanel from "@/components/ClaimPanel";
import MarkPanel from "@/components/MarkPanel";
import { lamportsToSol } from "@/lib/ww/quote";

/**
 * One battle on one screen: clock, pools, chart, trade, claim. The composite
 * wavewarz.com shows and wwtracker had spread across four routes.
 *
 * TWO SOURCES, KEPT APART ON PURPOSE. The chain (via /api/ww/battle-account)
 * gives the clock, the pools, the supplies and whether the program settled.
 * The public API (via the server page) gives the names, the tracks and the
 * stream link, none of which are on chain. Where the two disagree - and they
 * do, "winner" means the larger pool on chain and the judged result on the
 * site - this page shows the chain's number and says which is which.
 *
 * Chain state re-reads every 5 s while the battle is open and stops once it is
 * settled, because a settled account does not change.
 */

export interface SideInfo {
  artist: string;
  track: string;
  art: string | null;
}

interface ChainState {
  poolALamports: number;
  poolBLamports: number;
  supplyA: number;
  supplyB: number;
  endTime: number;
  settled: boolean;
  winnerArtistA: boolean;
}

export default function BattleView({
  battleId,
  sides,
  streamLink,
  siteUrl,
  tradingEnabled,
  marksEnabled = false,
  nameNote = "",
  communityTitle = null,
  communityHost = null,
}: {
  battleId: number;
  sides: { a: SideInfo; b: SideInfo } | null;
  streamLink: string | null;
  siteUrl: string | null;
  tradingEnabled: boolean;
  /** WW_MARKS, the operator's own machine during a battle night. Off everywhere else. */
  marksEnabled?: boolean;
  /**
   * Where the names came from, in words. Empty when they came from the public
   * API, which is the unremarkable case. Non-empty means the reader needs to
   * know: a community battle, a battle nobody has named, or an outage - and
   * the last two look identical without it.
   */
  nameNote?: string;
  communityTitle?: string | null;
  communityHost?: string | null;
}) {
  const [chain, setChain] = useState<ChainState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const load = async () => {
      try {
        const j = await fetch(`/api/ww/battle-account?battleId=${battleId}`).then((r) => r.json());
        if (!alive) return;
        if (j.status !== "ok") {
          setError(j.error ?? "Could not read this battle.");
          return;
        }
        setChain(j);
        if (j.settled && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (e) {
        if (alive) setError(String((e as Error).message ?? e));
      }
    };
    load();
    timer = setInterval(load, 5_000);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [battleId]);

  // Quick battles are song versus song and the API often has no handle for a
  // side; "unknown artist - Song" reads as a bug, so an unknown artist shows
  // the track alone.
  const label = (s: SideInfo | undefined, fallback: string) =>
    !s ? fallback : s.artist === "unknown artist" ? s.track : `${s.artist} - ${s.track}`;
  const labels = { a: label(sides?.a, "Artist A"), b: label(sides?.b, "Artist B") };
  const live = chain ? !chain.settled && chain.endTime > Math.floor(Date.now() / 1000) : false;

  const panel: React.CSSProperties = { background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 10, padding: 16 };

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px", color: C.text, fontFamily: "inherit" }}>
      <p style={metaLabel}>
        {communityHost ? `Community battle, run by ${communityHost}` : "WaveWarZ battle"}
      </p>
      <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>
        {communityTitle ?? (
          <>
            {labels.a} <span style={{ color: C.dim }}>vs</span> {labels.b}
          </>
        )}
      </h1>
      {communityTitle && (
        <p style={{ fontSize: 14, color: C.dim, margin: "0 0 4px" }}>
          {labels.a} vs {labels.b}
        </p>
      )}
      {nameNote && (
        <p style={{ fontSize: 12, color: C.dim, margin: "0 0 12px" }}>{nameNote}</p>
      )}
      {!nameNote && <div style={{ marginBottom: 12 }} />}

      <div style={{ ...panel, marginBottom: 12 }}>
        {chain ? (
          <BattleClock endTime={chain.endTime} settled={chain.settled} />
        ) : (
          <p style={{ margin: 0, color: C.dim, fontSize: 13 }}>{error ?? "Reading the battle account..."}</p>
        )}
        {chain && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {(["a", "b"] as const).map((s) => {
              const pool = s === "a" ? chain.poolALamports : chain.poolBLamports;
              const supply = s === "a" ? chain.supplyA : chain.supplyB;
              // A TIE IS NOT SIDE A LEADING. This read `poolA >= poolB` for
              // side A, so two exactly equal pools put "leads" under A - while
              // the program settles a tie to B (measured 2026-09-22 on battles
              // 1789783495 and 1790042941, and 28 battles have ended exactly
              // level). Neither side leads a tie, and saying one does is wrong
              // in the direction that costs the reader money.
              const tied = chain.poolALamports === chain.poolBLamports && chain.poolALamports > 0;
              const leading = !tied && (s === "a" ? chain.poolALamports > chain.poolBLamports : chain.poolBLamports > chain.poolALamports);
              return (
                <div key={s} style={{ borderLeft: `3px solid ${s === "a" ? C.accent : C.blue}`, paddingLeft: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: C.dim }}>{labels[s]}</p>
                  <p style={{ margin: "2px 0 0", fontFamily: C.mono, fontSize: 18 }}>
                    {lamportsToSol(pool).toFixed(4)} SOL
                    {leading ? <span style={{ color: C.dim, fontSize: 11 }}> leads</span> : null}
                    {tied ? <span style={{ color: C.dim, fontSize: 11 }}> tied</span> : null}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: C.dim, fontFamily: C.mono }}>{supply.toLocaleString()} tokens minted</p>
                </div>
              );
            })}
          </div>
        )}
        {chain?.settled && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>
            Chain winner by pool: {chain.winnerArtistA ? labels.a : labels.b}. The judged result lives on the site, and the
            two are different scoreboards.
            {chain.poolALamports === chain.poolBLamports && chain.poolALamports > 0
              ? " The pools finished exactly level: the program pays a tie from both pools together, in proportion to tokens held, rather than to a winner."
              : ""}
          </p>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <PoolChart battleId={battleId} live={live} labels={{ a: sides?.a.artist ?? "A", b: sides?.b.artist ?? "B" }} />
      </div>

      {marksEnabled && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <MarkPanel />
        </div>
      )}
      {chain && !chain.settled && tradingEnabled && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ ...metaLabel, marginBottom: 10 }}>Trade</p>
          <TradeWidget battleId={battleId} embedded />
        </div>
      )}
      {chain && !chain.settled && !tradingEnabled && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.dim }}>
            Trading is off on this deployment (WW_WIDGET is unset). The chart and clock are live.
          </p>
        </div>
      )}
      {chain?.settled && (
        <div style={{ marginBottom: 12 }}>
          <ClaimPanel />
        </div>
      )}

      {(streamLink || siteUrl) && (
        <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>
          {streamLink && (
            <a href={streamLink} target="_blank" rel="noreferrer" style={{ color: C.accent }}>
              Stream
            </a>
          )}
          {streamLink && siteUrl ? " / " : null}
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer" style={{ color: C.accent }}>
              This battle on wavewarz.info
            </a>
          )}
        </p>
      )}
    </main>
  );
}
