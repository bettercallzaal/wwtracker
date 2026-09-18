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
import {
  battleAccountsFromRaw,
  traderTokenAccountInstructions,
  type BattleAccounts,
} from "@/lib/ww/instructions";
import { computeUnitLimitInstruction, computeUnitPriceInstruction, serializeMessage } from "@/lib/ww/message";
import { planBuy, poolMoveBps } from "@/lib/ww/tradePlan";
import { lamportsToSol, quoteBuy, solToLamports } from "@/lib/ww/quote";

/**
 * The trading widget. Stage 1: prove it here, then it moves to wavewarz.info and
 * Candy implements it on her stack - so this component is a REFERENCE as much as
 * a feature, and the logic it depends on lives in `lib/ww/*` where it is
 * portable and tested, not in here.
 *
 * THE ORDER OF OPERATIONS IS THE SAFETY, and it is why preflight is not
 * optional. Every trade goes: build, simulate, show the result, and only then
 * offer to sign. The simulation asks the deployed program what would happen and
 * returns its own words - "Battle has already ended." rather than a hex code -
 * so nobody is asked to approve a transaction whose outcome is unknown to the
 * page showing it. A widget that signs first and explains afterwards is a
 * widget that spends fees to produce error messages.
 *
 * NOTHING HERE HOLDS A KEY. Phantom signs; this builds bytes and hands them
 * over. The RPC key stays on the server behind /api/ww/trade.
 */

const PRIORITY_MICRO_LAMPORTS = 1_000;
const COMPUTE_UNITS = 200_000;
/** Seconds the program will still accept the trade after it is built. */
const DEADLINE_SECONDS = 90;

type Phase = "idle" | "checking" | "ready" | "signing" | "sending" | "done";

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

const button = (tone: "accent" | "plain" | "danger"): React.CSSProperties => ({
  background: tone === "accent" ? C.accentDim : tone === "danger" ? "rgba(239,68,68,.12)" : C.elev,
  color: tone === "accent" ? C.accent : tone === "danger" ? C.danger : C.text,
  border: `1px solid ${tone === "accent" ? C.accent : C.grid}`,
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
});

export default function TradeWidget({ battleId }: { battleId: number }) {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleAccounts | null>(null);
  const [poolLamports, setPoolLamports] = useState<{ a: number; b: number } | null>(null);
  const [side, setSide] = useState<"a" | "b">("a");
  const [amountSol, setAmountSol] = useState("0.01");
  const [slippageBps, setSlippageBps] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  /**
   * How far the pool moved between the estimate on screen and the read the
   * transaction was actually built from. Surfaced rather than swallowed: the
   * person looked at one number and is being asked to sign against another, and
   * on a busy battle that gap is the whole reason the floor has to be fresh.
   */
  const [quoteDrift, setQuoteDrift] = useState<number | null>(null);

  // Extensions inject on their own schedule, so a single check on mount races
  // them. Poll briefly, then stop - "not installed" and "not injected yet" look
  // identical for the first moment of a page's life.
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

  // A switched account invalidates everything built for the old key. Clearing
  // the preflight matters more than clearing the address: a stale "would
  // succeed" next to a new wallet is a claim about a transaction nobody built.
  useEffect(() => {
    if (!provider) return;
    return watchWallet(provider, {
      onAccountChanged: (key) => {
        setWallet(key);
        setPreflight(null);
        setQuoteDrift(null);
        setSignature(null);
        setError(key ? null : "Wallet disconnected from this site.");
      },
      onDisconnect: () => {
        setWallet(null);
        setPreflight(null);
        setSignature(null);
      },
    });
  }, [provider]);

  // The battle's three wallets, read once. Everything else derives.
  useEffect(() => {
    let live = true;
    fetch(`/api/ww/battle-account?battleId=${battleId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        if (j.status !== "ok") {
          setError(j.error ?? "Could not read this battle.");
          return;
        }
        const raw = new Uint8Array(Buffer.from(j.account, "base64"));
        setBattle(battleAccountsFromRaw(raw));
        setPoolLamports({ a: j.poolALamports, b: j.poolBLamports });
      })
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [battleId]);

  const lamports = solToLamports(Number(amountSol) || 0);
  const pool = poolLamports ? poolLamports[side] : 0;
  const estimate = lamports > 0 && poolLamports ? quoteBuy(pool, lamports) : null;

  const onConnect = useCallback(async () => {
    if (!provider) return;
    setError(null);
    try {
      const c = await connect(provider);
      setWallet(c?.publicKey ?? null);
    } catch (e) {
      setError(mapWalletError(e).message);
    }
  }, [provider]);

  /**
   * Build the transaction from a pool read NOW.
   *
   * THIS USED TO USE THE MOUNT-TIME READ, and that was the defect: the
   * slippage floor - the trader's only protection against the price moving -
   * was computed from the pool as it was when the page loaded. On a live battle
   * that is whenever the tab happened to be opened. It never bit because the
   * widget has never run on a live battle, where the pool cannot move. See
   * lib/ww/tradePlan.ts.
   *
   * The estimate above still comes from the mount-time read, deliberately: it
   * is a display, it says it is approximate, and re-fetching on every keystroke
   * would spend the RPC budget on people typing. What must be fresh is the
   * number that goes into the instruction.
   */
  const build = useCallback(async () => {
    if (!wallet || !estimate) return null;
    const prep = await fetch("/api/ww/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
    }).then((r) => r.json());
    if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");

    const shownPool = poolLamports ? poolLamports[side] : 0;
    const plan = await planBuy({
      battleId,
      trader: wallet,
      side,
      amountLamports: lamports,
      slippageBps,
      deadlineSeconds: DEADLINE_SECONDS,
      readBattleState: async () => {
        const j = await fetch(`/api/ww/battle-account?battleId=${battleId}`).then((r) => r.json());
        if (j.status !== "ok") throw new Error(j.error ?? "could not read this battle");
        return {
          accounts: battleAccountsFromRaw(new Uint8Array(Buffer.from(j.account, "base64"))),
          poolLamports: { a: j.poolALamports, b: j.poolBLamports },
        };
      },
    });
    setQuoteDrift(poolMoveBps(shownPool, plan.poolLamports));
    const ix = plan.instruction;
    return serializeMessage(wallet, prep.blockhash, [
      computeUnitLimitInstruction(COMPUTE_UNITS),
      computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
      // Unconditionally, and before the trade. The program does not create the
      // trader's token accounts, so a wallet's first trade in a battle fails
      // without these; they are idempotent, so including them when the accounts
      // already exist costs a few hundred compute units and nothing else. The
      // alternative - read the accounts, include these only when absent - makes
      // the transaction depend on a fact that can stop being true between the
      // read and the signature.
      ...traderTokenAccountInstructions(battleId, wallet),
      ix,
    ]);
  }, [wallet, estimate, poolLamports, battleId, side, lamports, slippageBps]);

  const onPreflight = useCallback(async () => {
    setError(null);
    setPreflight(null);
    setPhase("checking");
    try {
      const message = await build();
      if (!message) return;
      // An unsigned transaction: one empty signature slot. The relay simulates
      // with sigVerify false, so this costs nothing and reveals the program's
      // own verdict before anyone is asked to approve anything.
      const unsigned = new Uint8Array(1 + 64 + message.length);
      unsigned[0] = 1;
      unsigned.set(message, 65);
      const res = await fetch("/api/ww/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "preflight",
          transaction: Buffer.from(unsigned).toString("base64"),
        }),
      }).then((r) => r.json());

      if (res.status === "would-succeed") {
        setPreflight({ ok: true, message: "The program accepts this trade.", unitsConsumed: res.unitsConsumed });
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

  /**
   * Sign and send. Only reachable once a preflight has SUCCEEDED - see the
   * disabled condition on the button. Rebuilding here rather than reusing the
   * preflighted bytes is deliberate: that blockhash is up to a couple of minutes
   * old by the time somebody reads the result and decides, and a stale blockhash
   * fails on chain after the fee is spent.
   */
  const onSend = useCallback(async () => {
    if (!provider || !preflight?.ok) return;
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
      } else {
        setError(res.error ?? "The trade was not sent.");
        setPhase("ready");
      }
    } catch (e) {
      setError(mapWalletError(e).message);
      setPhase("ready");
    }
  }, [provider, preflight, build]);

  return (
    <main style={{ maxWidth: 460, margin: "40px auto", padding: "0 16px", color: C.text, fontFamily: "inherit" }}>
      <p style={metaLabel}>WaveWarZ trade widget</p>
      <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>Battle {battleId}</h1>
      <p style={{ color: C.dim, fontSize: 13, margin: "0 0 18px" }}>
        Stage 1 reference implementation. Every trade is simulated against the program before you
        are asked to sign.
      </p>

      <div style={{ ...panel, marginBottom: 12 }}>
        {!provider && (
          <p style={{ margin: 0, color: C.dim, fontSize: 13 }}>
            No Phantom wallet detected. Install it, or open this page in a browser where it is
            enabled.
          </p>
        )}
        {provider && !wallet && (
          <button type="button" style={button("accent")} onClick={onConnect}>
            Connect Phantom
          </button>
        )}
        {wallet && (
          <p style={{ margin: 0, fontSize: 13, fontFamily: C.mono }}>
            <span style={{ color: C.dim }}>Connected </span>
            {wallet.slice(0, 6)}...{wallet.slice(-6)}
          </p>
        )}
      </div>

      <div style={{ ...panel, marginBottom: 12 }}>
        <p style={{ ...metaLabel, marginBottom: 10 }}>Buy</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["a", "b"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSide(s);
                setPreflight(null);
              }}
              style={{ ...button(side === s ? "accent" : "plain"), flex: 1 }}
            >
              Artist {s.toUpperCase()}
            </button>
          ))}
        </div>

        <label style={{ ...metaLabel, display: "block", marginBottom: 6 }}>Amount in SOL</label>
        <input
          value={amountSol}
          inputMode="decimal"
          onChange={(e) => {
            setAmountSol(e.target.value);
            setPreflight(null);
          }}
          style={{
            width: "100%", background: C.void, color: C.text, border: `1px solid ${C.grid}`,
            borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: C.mono,
          }}
        />

        <label style={{ ...metaLabel, display: "block", margin: "12px 0 6px" }}>
          Slippage tolerance
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {[50, 100, 300].map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => {
                setSlippageBps(bps);
                setPreflight(null);
              }}
              style={{ ...button(slippageBps === bps ? "accent" : "plain"), flex: 1 }}
            >
              {bps / 100}%
            </button>
          ))}
        </div>

        {estimate && (
          <p style={{ color: C.dim, fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
            Estimated {Math.floor(estimate.tokensOut).toLocaleString()} tokens.{" "}
            Fee {lamportsToSol(estimate.feeLamports).toFixed(6)} SOL.
            <br />
            <span style={{ color: C.dim }}>
              An estimate from the curve, accurate to about 0.5%. The exact figure comes from the
              simulation below.
            </span>
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          style={{ ...button("plain"), flex: 1 }}
          disabled={!wallet || !battle || !estimate || phase === "checking"}
          onClick={onPreflight}
        >
          {phase === "checking" ? "Simulating..." : "Simulate"}
        </button>
        <button
          type="button"
          style={{ ...button("accent"), flex: 1, opacity: preflight?.ok ? 1 : 0.4 }}
          // Signing is unreachable until the program has said it would accept
          // this trade. That is the safety, not a convenience.
          disabled={!preflight?.ok || phase === "signing" || phase === "sending"}
          onClick={onSend}
        >
          {phase === "signing" ? "Check Phantom..." : phase === "sending" ? "Sending..." : "Sign and send"}
        </button>
      </div>

      {quoteDrift !== null && Math.abs(quoteDrift) >= 50 && (
        <div style={{ ...panel, marginBottom: 12, borderColor: C.dim }}>
          <p style={{ margin: 0, fontSize: 12, color: C.dim }}>
            The pool moved {(quoteDrift / 100).toFixed(2)}% between the estimate above and the
            read this transaction was built from. The floor was recomputed against the newer
            one, so you are protected against the price you are actually getting.
          </p>
        </div>
      )}

      {preflight && (
        <div
          style={{
            ...panel,
            marginBottom: 12,
            borderColor: preflight.ok ? C.accent : C.danger,
          }}
        >
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
          <p style={{ ...metaLabel, color: C.accent, marginBottom: 6 }}>Sent</p>
          <p style={{ margin: 0, fontSize: 12, fontFamily: C.mono, wordBreak: "break-all" }}>
            {signature}
          </p>
        </div>
      )}
    </main>
  );
}
