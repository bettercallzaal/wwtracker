"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import {
  assembleSignedTransaction,
  connect,
  detectPhantom,
  mapWalletError,
  signMessage,
  unsignedTransaction,
  watchWallet,
  type PhantomProvider,
} from "@/lib/ww/wallet";
import { battleAccountsFromRaw, endBattleInstruction } from "@/lib/ww/instructions";
import { computeUnitLimitInstruction, computeUnitPriceInstruction, serializeMessage } from "@/lib/ww/message";
import { lamportsToSol } from "@/lib/ww/quote";
import { describeAge, secondsSinceEnd, type SettlePreview } from "@/lib/ww/settle";
import { describeBatches, packSettleBatches, type SettleBatch } from "@/lib/ww/settleBatch";
import { pollForChange } from "@/lib/ww/pollForChange";
import { describeConfirmation, type ConfirmResult } from "@/lib/ww/confirm";

/**
 * Settle a battle the program has not settled.
 *
 * SAME ORDER AS A TRADE: build, simulate, show the program's own verdict, then
 * offer to sign. endBattle takes no signer of its own; the connected wallet
 * pays the network fee and nothing else. What the settle does is shown from
 * lib/ww/settle.ts before the button is pressed: which side the PROGRAM will
 * call the winner (the larger pool, not the judges), and the three legs of
 * the losing pool.
 *
 * WHY THIS EXISTS. 81 battles sat past their end time with winner_decided 0
 * on 2026-09-20; a claim against any of them fails with BattleNotEnded. Zaal
 * settled six by hand on 09-19. This is the hand, with a preview and a
 * simulation in front of it.
 */

const PRIORITY_MICRO_LAMPORTS = 1_000;
const COMPUTE_UNITS = 60_000; // measured 11,936 units on a real simulation; headroom, not a guess doubled
/** Any 32-byte blockhash sizes the same, so batches are packed with a placeholder and signed with a fresh one. */
const SIZING_BLOCKHASH = "11111111111111111111111111111111";

/** What a finished batch left behind, kept after its rows leave the list. */
interface BatchResult {
  index: number;
  ids: number[];
  signature: string;
  confirmation: ConfirmResult | null;
}

interface Row {
  battleId: number;
  pubkey: string;
  startTime: number;
  endTime: number;
  poolLamports: { a: number; b: number };
  supply: { a: number; b: number };
  account: string;
  preview: SettlePreview;
}

type RowState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready"; ok: boolean; message: string; units: number | null }
  | { phase: "signing" }
  | { phase: "sending" }
  | { phase: "done"; signature: string; confirmation: ConfirmResult | null; list: "waiting" | "fresh" | "unconfirmed" }
  | { phase: "error"; message: string };

const panel: React.CSSProperties = { background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 10, padding: 16 };
const button = (tone: "accent" | "plain"): React.CSSProperties => ({
  background: tone === "accent" ? C.accentDim : C.elev,
  color: tone === "accent" ? C.accent : C.text,
  border: `1px solid ${tone === "accent" ? C.accent : C.grid}`,
  borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
});

export default function OperatorSettle() {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<Record<number, RowState>>({});
  const setRow = (id: number, s: RowState) => setStates((prev) => ({ ...prev, [id]: s }));
  // The batch run: one approval per transaction instead of one per battle.
  const [running, setRunning] = useState(false);
  const [runStep, setRunStep] = useState<string | null>(null);
  const [runDone, setRunDone] = useState<BatchResult[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const found = detectPhantom();
      if (found || ++tries > 10) {
        if (found) setProvider(found);
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!provider) return;
    return watchWallet(provider, {
      onAccountChanged: (key) => { setWallet(key); setStates({}); },
      onDisconnect: () => { setWallet(null); setStates({}); },
    });
  }, [provider]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const j = await fetch("/api/ww/unsettled").then((r) => r.json());
      if (j.status !== "ok") { setError(j.error ?? "Could not read the program's accounts."); return; }
      setRows(j.battles);
      setScanned(j.scanned);
      setReadAt(j.readAt);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onConnect = useCallback(async () => {
    if (!provider) return;
    try {
      const c = await connect(provider);
      setWallet(c?.publicKey ?? null);
    } catch (e) {
      setError(mapWalletError(e).message);
    }
  }, [provider]);

  const build = useCallback(async (row: Row) => {
    if (!wallet) throw new Error("connect a wallet first");
    const prep = await fetch("/api/ww/trade", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare" }),
    }).then((r) => r.json());
    if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");
    const battle = battleAccountsFromRaw(new Uint8Array(Buffer.from(row.account, "base64")));
    return serializeMessage(wallet, prep.blockhash, [
      computeUnitLimitInstruction(COMPUTE_UNITS),
      computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
      endBattleInstruction({ battleId: row.battleId, battle }),
    ]);
  }, [wallet]);

  const onSimulate = useCallback(async (row: Row) => {
    setRow(row.battleId, { phase: "checking" });
    try {
      const message = await build(row);
      // The same envelope a wallet is handed (#345): a transaction, not a
      // bare message. One helper, so this cannot drift from the widget.
      const unsigned = unsignedTransaction(message);
      const res = await fetch("/api/ww/trade", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preflight", transaction: Buffer.from(unsigned).toString("base64") }),
      }).then((r) => r.json());
      if (res.status === "would-succeed") setRow(row.battleId, { phase: "ready", ok: true, message: "The program accepts this settle.", units: res.unitsConsumed ?? null });
      else if (res.status === "would-fail") setRow(row.battleId, { phase: "ready", ok: false, message: res.error, units: res.unitsConsumed ?? null });
      else setRow(row.battleId, { phase: "error", message: res.error ?? "Preflight failed." });
    } catch (e) {
      setRow(row.battleId, { phase: "error", message: mapWalletError(e).message });
    }
  }, [build]);

  const onSettle = useCallback(async (row: Row) => {
    if (!provider) return;
    const st = states[row.battleId];
    if (!st || st.phase !== "ready" || !st.ok) return;
    setRow(row.battleId, { phase: "signing" });
    try {
      // Rebuilt for a fresh blockhash; the preflighted bytes may be minutes old.
      const message = await build(row);
      const sig = await signMessage(provider, message);
      const tx = assembleSignedTransaction(message, sig);
      setRow(row.battleId, { phase: "sending" });
      const res = await fetch("/api/ww/trade", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send", transaction: Buffer.from(tx).toString("base64") }),
      }).then((r) => r.json());
      if (res.status === "sent") {
        // "sent" carries the cluster's word since #352: landed, failed, or
        // not known yet. Shown as the route reports it, never flattened.
        const confirmation: ConfirmResult | null = res.confirmation ?? null;
        setRow(row.battleId, { phase: "done", signature: res.signature, confirmation, list: "waiting" });
        // READ AGAIN UNTIL THE ROW LEAVES THE LIST. The first version did one
        // setTimeout(load, 4000): a single read at a moment picked in
        // advance, the shape behind #348. The row disappears only when the
        // program's winner_decided byte is 1, so that is what is polled for.
        const settled = row.battleId;
        const r = await pollForChange({
          read: async () => {
            const j = await fetch("/api/ww/unsettled").then((x) => x.json());
            if (j.status !== "ok") throw new Error(j.error ?? "Could not read the program's accounts.");
            return j as { battles: Row[]; scanned: number; readAt: string };
          },
          from: { battles: rows ?? [], scanned: scanned ?? 0, readAt: readAt ?? "" },
          same: (x, y) => x.battles.some((b) => b.battleId === settled) === y.battles.some((b) => b.battleId === settled),
          attempts: 10,
          delayMs: 2_000,
        });
        setRows(r.value.battles);
        setScanned(r.value.scanned);
        setReadAt(r.value.readAt);
        setRow(row.battleId, { phase: "done", signature: res.signature, confirmation, list: r.changed ? "fresh" : "unconfirmed" });
      } else {
        setRow(row.battleId, { phase: "error", message: res.error ?? "Not sent." });
      }
    } catch (e) {
      setRow(row.battleId, { phase: "error", message: mapWalletError(e).message });
    }
  }, [provider, states, build, rows, scanned, readAt]);

  /** endBattle instructions for a set of rows, in the order given. */
  const settleInstructions = useCallback(
    (batch: Row[]) =>
      batch.map((r) => endBattleInstruction({ battleId: r.battleId, battle: battleAccountsFromRaw(new Uint8Array(Buffer.from(r.account, "base64"))) })),
    [],
  );

  /**
   * The order settles run in: battles that still hold money first, oldest
   * first inside each group. 71 of the 82 unsettled on 2026-09-22 had empty
   * pools, and an empty settle distributes nothing; if a run is interrupted,
   * the ones that matter are already done.
   */
  const orderedRows = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => Number(a.preview.empty) - Number(b.preview.empty) || a.endTime - b.endTime);
  }, [rows]);

  const batches: Array<SettleBatch<Row>> = useMemo(() => {
    if (!wallet || orderedRows.length === 0) return [];
    return packSettleBatches(orderedRows, (batch) =>
      serializeMessage(wallet, SIZING_BLOCKHASH, [
        computeUnitLimitInstruction(1_400_000),
        computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
        ...settleInstructions(batch),
      ]).length,
    );
  }, [wallet, orderedRows, settleInstructions]);

  /**
   * Run every batch: simulate, sign, send, wait for the chain's word, next.
   *
   * SIMULATE EACH BATCH IMMEDIATELY BEFORE SIGNING IT, because one failed
   * instruction fails the whole transaction: if anyone settles one of these
   * between the scan and the signature, the batch would fail and the run stops
   * and re-reads rather than spending an approval on it.
   */
  const runBatches = useCallback(async () => {
    if (!provider || !wallet || batches.length === 0) return;
    stopRef.current = false;
    setRunning(true);
    setRunError(null);
    setRunDone([]);
    try {
      for (let i = 0; i < batches.length; i++) {
        if (stopRef.current) { setRunStep(`Stopped after ${i} of ${batches.length}.`); return; }
        const batch = batches[i];
        const label = `Batch ${i + 1} of ${batches.length} (${batch.items.length} battles)`;
        const ids = batch.items.map((r) => r.battleId);

        setRunStep(`${label}: checking with the program...`);
        const prep = await fetch("/api/ww/trade", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare" }),
        }).then((r) => r.json());
        if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");
        const message = serializeMessage(wallet, prep.blockhash, [
          computeUnitLimitInstruction(batch.unitLimit),
          computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
          ...settleInstructions(batch.items),
        ]);
        const sim = await fetch("/api/ww/trade", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "preflight", transaction: Buffer.from(unsignedTransaction(message)).toString("base64") }),
        }).then((r) => r.json());
        if (sim.status !== "would-succeed") {
          setRunError(`${label} would fail: ${sim.error ?? "unknown reason"}. Nothing was signed. Re-reading the list.`);
          await load();
          return;
        }

        setRunStep(`${label}: approve in your wallet...`);
        const sig = await signMessage(provider, message);
        const tx = assembleSignedTransaction(message, sig);
        setRunStep(`${label}: sending...`);
        const res = await fetch("/api/ww/trade", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "send", transaction: Buffer.from(tx).toString("base64") }),
        }).then((r) => r.json());
        if (res.status !== "sent") {
          setRunError(`${label} was not sent: ${res.error ?? "no reason given"}.`);
          return;
        }
        const confirmation: ConfirmResult | null = res.confirmation ?? null;
        setRunDone((prev) => [...prev, { index: i + 1, ids, signature: res.signature, confirmation }]);
        for (const id of ids) setRow(id, { phase: "done", signature: res.signature, confirmation, list: "waiting" });
        if (confirmation && confirmation.outcome === "failed") {
          setRunError(`${label} was rejected by the chain: ${confirmation.error ?? "no reason given"}. Stopping so the rest are not sent blind.`);
          await load();
          return;
        }
      }
      setRunStep("All batches sent. Re-reading the program's accounts...");
      await load();
      setRunStep(null);
    } catch (e) {
      setRunError(mapWalletError(e).message);
    } finally {
      setRunning(false);
    }
  }, [provider, wallet, batches, settleInstructions, load]);

  const now = Math.floor(Date.now() / 1000);
  const settledHere = Object.entries(states).filter((e): e is [string, Extract<RowState, { phase: "done" }>] => e[1].phase === "done");

  return (
    <main style={{ maxWidth: 820, margin: "32px auto", padding: "0 16px", color: C.text, fontFamily: "inherit" }}>
      <p style={metaLabel}>WaveWarZ operator</p>
      <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>Unsettled battles</h1>
      <p style={{ color: C.dim, fontSize: 13, margin: "0 0 16px" }}>
        Past their end time, winner_decided still 0 on chain. A claim against any of these fails until it is
        settled. endBattle is permissionless: the wallet pays the network fee and receives nothing. Use
        &quot;Settle everything&quot; for the whole list; the rows below are for settling one on its own.
      </p>

      <div style={{ ...panel, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          {!provider && <span style={{ color: C.dim, fontSize: 13 }}>No Phantom wallet detected.</span>}
          {provider && !wallet && <button type="button" style={button("accent")} onClick={onConnect}>Connect Phantom</button>}
          {wallet && <span style={{ fontSize: 13, fontFamily: C.mono }}><span style={{ color: C.dim }}>Fee payer </span>{wallet.slice(0, 6)}...{wallet.slice(-6)}</span>}
        </div>
        <div style={{ fontSize: 12, color: C.dim, textAlign: "right" }}>
          {rows && <span>{rows.length} unsettled of {scanned} battle accounts{readAt ? `, read ${new Date(readAt).toLocaleTimeString()}` : ""}</span>}
          {" "}<button type="button" style={{ ...button("plain"), padding: "4px 8px", fontSize: 12 }} onClick={load}>Re-read</button>
        </div>
      </div>

      {error && <div style={{ ...panel, borderColor: C.danger, marginBottom: 12 }}><p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p></div>}

      {/* SETTLE EVERYTHING, IN AS FEW APPROVALS AS THE PACKET ALLOWS. Several
          endBattle instructions fit in one transaction, so 82 battles is 11
          signatures rather than 82. Sized for a phone: one button, one line
          saying what is happening. */}
      {wallet && batches.length > 0 && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ ...metaLabel, margin: "0 0 6px" }}>Settle everything</p>
          <p style={{ margin: "0 0 10px", fontSize: 13 }}>{describeBatches(batches)}</p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: C.dim }}>
            Battles that still hold money go first. Each transaction is checked with the program before
            your wallet is asked, and the run stops if one would fail. You pay network fees only.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{ ...button("accent"), padding: "12px 18px", fontSize: 15, flex: "1 1 220px" }}
              disabled={running}
              onClick={runBatches}
            >
              {running ? "Settling..." : `Settle all ${orderedRows.length} in ${batches.length} approvals`}
            </button>
            {running && (
              <button type="button" style={{ ...button("plain"), padding: "12px 18px", fontSize: 15 }} onClick={() => { stopRef.current = true; }}>
                Stop after this one
              </button>
            )}
          </div>
          {runStep && <p style={{ margin: "10px 0 0", fontSize: 13, color: C.accent }}>{runStep}</p>}
          {runError && <p style={{ margin: "10px 0 0", fontSize: 13, color: C.danger }}>{runError}</p>}
          {runDone.length > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>
              {runDone.reduce((n, r) => n + r.ids.length, 0)} battles sent in {runDone.length} transaction
              {runDone.length === 1 ? "" : "s"}
              {runDone.some((r) => r.confirmation?.outcome !== "landed") ? "; not all confirmed yet, see below." : ", all confirmed on chain."}
            </p>
          )}
        </div>
      )}

      {/* Settles from this session live here, not in the row: a settled row
          leaves the list when the chain confirms it, and its message must not
          leave with it. */}
      {settledHere.length > 0 && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ ...metaLabel, margin: "0 0 6px" }}>Settled this session</p>
          {runDone.map((r) => (
            <div key={`batch-${r.index}`} style={{ fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono }}>Batch {r.index}</span>{" "}
              <span style={{ color: C.dim }}>{r.ids.length} battles: {r.ids.join(", ")}</span>{" "}
              <span style={{ color: r.confirmation?.outcome === "landed" ? C.accent : r.confirmation?.outcome === "failed" ? C.danger : C.dim }}>
                {r.confirmation ? describeConfirmation(r.confirmation, r.signature) : `Sent (${r.signature.slice(0, 8)}...); the route reported no confirmation.`}
              </span>
            </div>
          ))}
          {settledHere.map(([id, st]) => (
            <div key={id} style={{ fontSize: 12, marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono }}>{id}</span>{" "}
              <span style={{ color: st.confirmation?.outcome === "landed" ? C.accent : st.confirmation?.outcome === "failed" ? C.danger : C.dim }}>
                {st.confirmation ? describeConfirmation(st.confirmation, st.signature) : `Sent (${st.signature.slice(0, 8)}...); the route reported no confirmation.`}
              </span>
              {st.list === "waiting" && <span style={{ color: C.dim }}> Re-reading the program's accounts until it leaves the list...</span>}
              {st.list === "unconfirmed" && <span style={{ color: C.danger }}> Still listed as unsettled after 10 reads; check the signature before settling it again.</span>}
              {st.list === "fresh" && <span style={{ color: C.dim }}> {rows?.some((r) => r.battleId === Number(id)) ? "Still listed after the re-read." : "Gone from the list: winner_decided is 1 on chain."}</span>}
            </div>
          ))}
        </div>
      )}
      {!rows && !error && <p style={{ color: C.dim, fontSize: 13 }}>Reading every battle account from the program...</p>}
      {rows && rows.length === 0 && <p style={{ color: C.dim, fontSize: 13 }}>Nothing awaiting settlement. Every ended battle is settled.</p>}

      {rows?.map((row) => {
        const st = states[row.battleId] ?? { phase: "idle" as const };
        const p = row.preview;
        return (
          <div key={row.battleId} style={{ ...panel, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontFamily: C.mono, fontSize: 15 }}>
                  <a href={`/battle/${row.battleId}`} style={{ color: C.text }}>{row.battleId}</a>
                  <span style={{ color: C.dim, fontSize: 12 }}> ended {describeAge(secondsSinceEnd(row.endTime, now))}</span>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
                  A {lamportsToSol(row.poolLamports.a).toFixed(4)} SOL / {row.supply.a.toLocaleString()} tokens
                  {"  "}B {lamportsToSol(row.poolLamports.b).toFixed(4)} SOL / {row.supply.b.toLocaleString()} tokens
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                  {p.empty ? (
                    <span style={{ color: C.dim }}>Both pools empty: settling distributes nothing.</span>
                  ) : (
                    <>
                      Program winner by pool: <strong>{p.winner.toUpperCase()}</strong>{p.tie ? " (pools tied; the program gives a tie to B)" : ""}. Winners share{" "}
                      {lamportsToSol(p.winnerDistribution).toFixed(4)} SOL, losers share {lamportsToSol(p.loserSharePool).toFixed(4)} SOL,{" "}
                      {lamportsToSol(p.leavesVaultLamports).toFixed(4)} SOL to artists and platform.
                    </>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <button type="button" style={button("plain")} disabled={!wallet || st.phase === "checking"} onClick={() => onSimulate(row)}>
                  {st.phase === "checking" ? "Simulating..." : "Simulate"}
                </button>
                <button
                  type="button"
                  style={{ ...button("accent"), opacity: st.phase === "ready" && st.ok ? 1 : 0.4 }}
                  disabled={!(st.phase === "ready" && st.ok)}
                  onClick={() => onSettle(row)}
                >
                  Sign and settle
                </button>
              </div>
            </div>
            {st.phase === "ready" && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: st.ok ? C.accent : C.danger }}>
                {st.ok ? "Would succeed" : "Would fail"}: {st.message}{st.units !== null ? ` (${st.units.toLocaleString()} compute units)` : ""}
              </p>
            )}
            {st.phase === "signing" && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>Check Phantom...</p>}
            {st.phase === "sending" && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>Sending...</p>}
            {st.phase === "done" && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.dim }}>Settled from this page; see above.</p>}
            {st.phase === "error" && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.danger }}>{st.message}</p>}
          </div>
        );
      })}
    </main>
  );
}
