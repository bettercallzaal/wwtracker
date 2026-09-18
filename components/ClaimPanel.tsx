"use client";

import { useCallback, useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import {
  assembleSignedTransaction,
  connect,
  detectPhantom,
  mapWalletError,
  signMessage,
  watchWallet,
  type PhantomProvider,
} from "@/lib/ww/wallet";
import { claimSharesInstruction } from "@/lib/ww/instructions";
import { computeUnitLimitInstruction, computeUnitPriceInstruction, serializeMessage } from "@/lib/ww/message";
import { battlesToClaim, vaultPayableLamports, type ClaimablePosition } from "@/lib/ww/claim";
import { lamportsToSol } from "@/lib/ww/quote";

/**
 * The claim panel. Stage 1, like the trade widget, and the same order of
 * operations: read, build, simulate, show, and only then offer to sign.
 *
 * WHY THIS EXISTS BEFORE A SELL PANEL. A claim runs against a SETTLED battle, so
 * it needs nothing to be live. The trade widget has been built and unproven since
 * 2026-09-17 because no battle has opened since, and this path was available the
 * whole time. It also exercises the one piece that has never run against a real
 * wallet - `signMessage` in lib/ww/wallet.ts, which says so in its own header.
 *
 * AND IT MOVES LESS RISK, NOT MORE. Claiming withdraws SOL the wallet is already
 * owed for a settled position. It spends a fee and nothing else.
 *
 * EVERY FIGURE HERE COMES FROM A READ AT RENDER TIME. There is no cached
 * balance and no list of who is owed what - see lib/ww/claim.ts, and
 * `recon/UNCLAIMED.md` in the protocol repo for why a list is the wrong build.
 * The one number this component keeps is what the last read returned, and it is
 * cleared the moment the wallet changes.
 */

const PRIORITY_MICRO_LAMPORTS = 1_000;
const COMPUTE_UNITS = 200_000;

type Phase = "idle" | "reading" | "checking" | "ready" | "signing" | "sending" | "done";

interface Preflight {
  ok: boolean;
  message: string;
  unitsConsumed: number | null;
}

const panel: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.grid}`,
  borderRadius: 10,
  padding: 16,
};

const button = (tone: "accent" | "plain"): React.CSSProperties => ({
  background: tone === "accent" ? C.accentDim : C.elev,
  color: tone === "accent" ? C.accent : C.text,
  border: `1px solid ${tone === "accent" ? C.accent : C.grid}`,
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
});

export default function ClaimPanel() {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [positions, setPositions] = useState<ClaimablePosition[] | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

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

  /** Everything read for the old key is a claim about a different wallet. */
  const resetForWallet = useCallback((key: string | null) => {
    setWallet(key);
    setPositions(null);
    setReadAt(null);
    setSelected(null);
    setPreflight(null);
    setSignature(null);
  }, []);

  useEffect(() => {
    if (!provider) return;
    return watchWallet(provider, {
      onAccountChanged: (key) => {
        resetForWallet(key);
        setError(key ? null : "Wallet disconnected from this site.");
      },
      onDisconnect: () => resetForWallet(null),
    });
  }, [provider, resetForWallet]);

  /**
   * Read what this wallet can claim, now. Called on connect and on demand, and
   * never cached: `recon/UNCLAIMED.md` measured this set draining 1.76% in one
   * quiet day, so a figure kept across a page life is a figure that will be
   * wrong while looking authoritative.
   */
  const read = useCallback(async (key: string) => {
    setError(null);
    setPhase("reading");
    setPreflight(null);
    try {
      const res = await fetch(`/api/ww/claimable?wallet=${encodeURIComponent(key)}`).then((r) => r.json());
      if (res.status !== "ok") {
        setError(res.error ?? "Could not read this wallet.");
        setPositions(null);
        return;
      }
      setPositions(res.positions);
      setReadAt(res.readAt ?? null);
      setSelected(res.positions.length ? res.positions[0].battleId : null);
    } catch (e) {
      setError(String(e));
    } finally {
      setPhase("idle");
    }
  }, []);

  const onConnect = useCallback(async () => {
    if (!provider) return;
    setError(null);
    try {
      const c = await connect(provider);
      resetForWallet(c?.publicKey ?? null);
      if (c?.publicKey) await read(c.publicKey);
    } catch (e) {
      setError(mapWalletError(e).message);
    }
  }, [provider, read, resetForWallet]);

  /** Build the claim for one battle. Nothing about it depends on the read's amounts. */
  const build = useCallback(async () => {
    if (!wallet || selected === null) return null;
    const prep = await fetch("/api/ww/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
    }).then((r) => r.json());
    if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");

    return serializeMessage(wallet, prep.blockhash, [
      computeUnitLimitInstruction(COMPUTE_UNITS),
      computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
      // No ATA creation: a wallet that holds the tokens necessarily has the
      // accounts. This path does not depend on #296's fix.
      claimSharesInstruction({ battleId: selected, trader: wallet }),
    ]);
  }, [wallet, selected]);

  const onPreflight = useCallback(async () => {
    setError(null);
    setPreflight(null);
    setPhase("checking");
    try {
      const message = await build();
      if (!message) return;
      const unsigned = new Uint8Array(1 + 64 + message.length);
      unsigned[0] = 1;
      unsigned.set(message, 65);
      const res = await fetch("/api/ww/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preflight", transaction: Buffer.from(unsigned).toString("base64") }),
      }).then((r) => r.json());

      if (res.status === "would-succeed") {
        setPreflight({ ok: true, message: "The program accepts this claim.", unitsConsumed: res.unitsConsumed });
      } else if (res.status === "would-fail") {
        setPreflight({ ok: false, message: res.error, unitsConsumed: res.unitsConsumed });
      } else {
        setError(res.error ?? "Preflight failed.");
      }
    } catch (e) {
      setError(mapWalletError(e).message);
    } finally {
      setPhase("ready");
    }
  }, [build]);

  /** Only reachable once the program has said it would accept the claim. */
  const onClaim = useCallback(async () => {
    if (!provider || !preflight?.ok || !wallet) return;
    setError(null);
    setPhase("signing");
    try {
      const message = await build();
      if (!message) return;
      const sig = await signMessage(provider, message);
      const tx = assembleSignedTransaction(message, sig);
      setPhase("sending");
      const res = await fetch("/api/ww/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send", transaction: Buffer.from(tx).toString("base64") }),
      }).then((r) => r.json());

      if (res.status === "sent") {
        setSignature(res.signature);
        setPhase("done");
        // The position just changed. Re-read rather than adjust a number here.
        await read(wallet);
      } else {
        setError(res.error ?? "The claim was not sent.");
        setPhase("ready");
      }
    } catch (e) {
      setError(mapWalletError(e).message);
      setPhase("ready");
    }
  }, [provider, preflight, build, wallet, read]);

  const total = positions
    ? battlesToClaim(positions).reduce((sum, id) => {
        const p = positions.find((x) => x.battleId === id);
        return sum + (p ? vaultPayableLamports(p.vaultLamports) : 0);
      }, 0)
    : 0;

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px", color: C.text, fontFamily: "inherit" }}>
      <p style={metaLabel}>WaveWarZ claim panel</p>
      <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>Claim settled winnings</h1>
      <p style={{ color: C.dim, fontSize: 13, margin: "0 0 18px" }}>
        Read live from chain each time. Every claim is simulated against the program before you are
        asked to sign.
      </p>

      <div style={{ ...panel, marginBottom: 12 }}>
        {!provider && (
          <p style={{ margin: 0, color: C.dim, fontSize: 13 }}>
            No Phantom wallet detected. Install it, or open this page in a browser where it is enabled.
          </p>
        )}
        {provider && !wallet && (
          <button type="button" style={button("accent")} onClick={onConnect}>
            Connect Phantom
          </button>
        )}
        {wallet && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontFamily: C.mono }}>
              <span style={{ color: C.dim }}>Connected </span>
              {wallet.slice(0, 6)}...{wallet.slice(-6)}
            </p>
            <button type="button" style={button("plain")} disabled={phase === "reading"} onClick={() => read(wallet)}>
              {phase === "reading" ? "Reading..." : "Re-read"}
            </button>
          </div>
        )}
      </div>

      {positions && positions.length === 0 && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13 }}>Nothing to claim for this wallet right now.</p>
        </div>
      )}

      {positions && positions.length > 0 && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <p style={{ ...metaLabel, marginBottom: 10 }}>
            {battlesToClaim(positions).length} settled {battlesToClaim(positions).length === 1 ? "battle" : "battles"}
            {" - "}
            {lamportsToSol(total).toFixed(6)} SOL in their vaults
          </p>
          {battlesToClaim(positions).map((id) => {
            const sides = positions.filter((p) => p.battleId === id);
            const vault = sides[0].vaultLamports;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelected(id);
                  setPreflight(null);
                }}
                style={{
                  ...button(selected === id ? "accent" : "plain"),
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 8,
                  fontFamily: C.mono,
                  fontSize: 12,
                }}
              >
                {id} - side {sides.map((s) => s.side.toUpperCase()).join(" and ")} -{" "}
                {lamportsToSol(vaultPayableLamports(vault)).toFixed(6)} SOL in vault
              </button>
            );
          })}
          {readAt && (
            <p style={{ color: C.dim, fontSize: 11, margin: "8px 0 0", fontFamily: C.mono }}>
              read {new Date(readAt).toLocaleTimeString()}. The vault figure is what the battle holds,
              not what this wallet is owed - the program works out the share.
            </p>
          )}
        </div>
      )}

      {positions && positions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            style={{ ...button("plain"), flex: 1 }}
            disabled={selected === null || phase === "checking"}
            onClick={onPreflight}
          >
            {phase === "checking" ? "Simulating..." : "Simulate"}
          </button>
          <button
            type="button"
            style={{ ...button("accent"), flex: 1, opacity: preflight?.ok ? 1 : 0.4 }}
            disabled={!preflight?.ok || phase === "signing" || phase === "sending"}
            onClick={onClaim}
          >
            {phase === "signing" ? "Check Phantom..." : phase === "sending" ? "Sending..." : "Sign and claim"}
          </button>
        </div>
      )}

      {preflight && (
        <div style={{ ...panel, marginBottom: 12, borderColor: preflight.ok ? C.accent : C.danger }}>
          <p style={{ ...metaLabel, color: preflight.ok ? C.accent : C.danger, marginBottom: 6 }}>
            {preflight.ok ? "Would succeed" : "Would fail"}
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>{preflight.message}</p>
          {preflight.unitsConsumed !== null && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
              {preflight.unitsConsumed.toLocaleString()} compute units
            </p>
          )}
        </div>
      )}

      {error && (
        <div style={{ ...panel, borderColor: C.danger, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>
        </div>
      )}

      {signature && (
        <div style={{ ...panel, borderColor: C.accent }}>
          <p style={{ ...metaLabel, color: C.accent, marginBottom: 6 }}>Claimed</p>
          <p style={{ margin: 0, fontSize: 12, fontFamily: C.mono, wordBreak: "break-all" }}>{signature}</p>
        </div>
      )}
    </main>
  );
}
