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
import { planBuy, planSell, poolMoveBps, type BattleState } from "@/lib/ww/tradePlan";
import { describePriceImpact, type PriceImpactAssessment } from "@/lib/ww/priceImpact";
import { lamportsToSol, quoteBuy, solToLamports, withSlippage } from "@/lib/ww/quote";
import { sellEstimate, shareOfSide } from "@/lib/ww/widgetSell";
import { pollForChange } from "@/lib/ww/pollForChange";
import { describeConfirmation, type ConfirmResult } from "@/lib/ww/confirm";

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
 * BUY AND SELL, since 2026-09-21. The widget was buy-only through the finals,
 * so nothing learned about selling that night could be acted on here. The sell
 * path prices off the side's MINTED supply (bytes 196/204, now returned by
 * /api/ww/battle-account), sizes against the wallet's balance from
 * /api/ww/token-balance, and puts its slippage floor on the NET proceeds, which
 * is the number the program checks. See lib/ww/widgetSell.ts and planSell.
 *
 * NOTHING HERE HOLDS A KEY. Phantom signs; this builds bytes and hands them
 * over. The RPC key stays on the server behind /api/ww/trade.
 */

const PRIORITY_MICRO_LAMPORTS = 1_000;
const COMPUTE_UNITS = 200_000;
/** Seconds the program will still accept the trade after it is built. */
const DEADLINE_SECONDS = 90;

type Phase = "idle" | "checking" | "ready" | "signing" | "sending" | "done";
type Mode = "buy" | "sell";

interface Preflight {
  ok: boolean;
  message: string;
  unitsConsumed: number | null;
}

interface BattleRead {
  accounts: BattleAccounts;
  poolLamports: { a: number; b: number };
  mintedSupply: { a: number; b: number };
  endTime: number;
  settled: boolean;
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

const input: React.CSSProperties = {
  width: "100%", background: C.void, color: C.text, border: `1px solid ${C.grid}`,
  borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: C.mono,
};

/** One read of the battle account, decoded the same way for mount and for build. */
async function readBattle(battleId: number): Promise<BattleRead> {
  const j = await fetch(`/api/ww/battle-account?battleId=${battleId}`).then((r) => r.json());
  if (j.status !== "ok") throw new Error(j.error ?? "could not read this battle");
  return {
    accounts: battleAccountsFromRaw(new Uint8Array(Buffer.from(j.account, "base64"))),
    poolLamports: { a: j.poolALamports, b: j.poolBLamports },
    mintedSupply: { a: j.supplyA, b: j.supplyB },
    endTime: j.endTime,
    settled: j.settled,
  };
}

/**
 * `embedded`: rendered inside the battle page, which already carries the
 * battle's title and clock, so the widget drops its own header and outer
 * margin and becomes a panel among panels. Behaviour is identical.
 */
export default function TradeWidget({ battleId, embedded = false }: { battleId: number; embedded?: boolean }) {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleRead | null>(null);
  const [mode, setMode] = useState<Mode>("buy");
  const [side, setSide] = useState<"a" | "b">("a");
  const [amountSol, setAmountSol] = useState("0.01");
  const [amountTokens, setAmountTokens] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  /** The cluster's own word on the last send: landed, failed, or not known yet. */
  const [confirmation, setConfirmation] = useState<ConfirmResult | null>(null);
  /** The wallet's tokens on each side, base units. null until read. */
  const [balances, setBalances] = useState<{ a: number; b: number } | null>(null);
  /** Whether the balance on screen is known good, or still catching up after a trade. */
  const [balanceState, setBalanceState] = useState<"fresh" | "waiting" | "unconfirmed">("fresh");
  /** Max is reading the chain; the button says so rather than looking dead. */
  const [maxReading, setMaxReading] = useState(false);
  /**
   * How far the pool moved between the estimate on screen and the read the
   * transaction was actually built from. Surfaced rather than swallowed: the
   * person looked at one number and is being asked to sign against another, and
   * on a busy battle that gap is the whole reason the floor has to be fresh.
   */
  const [quoteDrift, setQuoteDrift] = useState<number | null>(null);
  /**
   * What the built transaction does to the price. From the plan, so it is
   * computed against the same fresh read as the slippage floor rather than the
   * estimate on screen.
   */
  const [priceImpact, setPriceImpact] = useState<PriceImpactAssessment | null>(null);

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
        setBalances(null);
        setPreflight(null);
        setQuoteDrift(null);
        setPriceImpact(null);
        setSignature(null);
        setError(key ? null : "Wallet disconnected from this site.");
      },
      onDisconnect: () => {
        setWallet(null);
        setBalances(null);
        setPreflight(null);
        setSignature(null);
      },
    });
  }, [provider]);

  // The battle, read once for display. Everything else derives.
  useEffect(() => {
    let live = true;
    readBattle(battleId)
      .then((b) => live && setBattle(b))
      .catch((e) => live && setError(String((e as Error).message ?? e)));
    return () => {
      live = false;
    };
  }, [battleId]);

  /**
   * The wallet's balance on both sides. Read when a wallet connects and again
   * after every sent trade, not on a timer: it changes only when this wallet
   * trades, and a timer would spend the RPC budget confirming that.
   */
  const readBalances = useCallback(async (key: string): Promise<{ a: number; b: number }> => {
    const j = await fetch(`/api/ww/token-balance?battleId=${battleId}&wallet=${key}`).then((r) => r.json());
    if (j.status !== "ok") throw new Error(j.error ?? "could not read this wallet's tokens");
    return j.balances;
  }, [battleId]);

  const refreshBalances = useCallback(async (key: string) => {
    setBalances(await readBalances(key));
  }, [readBalances]);

  /**
   * After a trade lands, READ AGAIN UNTIL IT MOVES.
   *
   * A single read here is the defect that cost the first live sell: the RPC
   * had not processed the transaction yet, answered 0 correctly for that
   * moment, and the widget told the person they held nothing while the chain
   * held 10,800,000 tokens (battle 1790043661, 2026-09-21). `balanceState`
   * says whether the number on screen is confirmed or still catching up, so
   * the page can say which rather than showing a stale figure as fact.
   */
  const refreshBalancesAfterTrade = useCallback(async (key: string, before: { a: number; b: number } | null) => {
    if (!before) return refreshBalances(key);
    setBalanceState("waiting");
    const r = await pollForChange({
      read: () => readBalances(key),
      from: before,
      same: (x, y) => x.a === y.a && x.b === y.b,
      attempts: 10,
      delayMs: 1_500,
    });
    setBalances(r.value);
    setBalanceState(r.changed ? "fresh" : "unconfirmed");
  }, [readBalances, refreshBalances]);

  useEffect(() => {
    if (!wallet) return;
    refreshBalances(wallet).catch((e) => setError(String((e as Error).message ?? e)));
  }, [wallet, refreshBalances]);

  const lamports = solToLamports(Number(amountSol) || 0);
  const tokens = Math.floor(Number(amountTokens) || 0);
  const pool = battle ? battle.poolLamports[side] : 0;
  const minted = battle ? battle.mintedSupply[side] : null;
  const held = balances ? balances[side] : null;

  const buyEstimate = mode === "buy" && lamports > 0 && battle ? quoteBuy(pool, lamports) : null;
  const sell =
    mode === "sell" && battle && held !== null
      ? sellEstimate({ poolLamports: pool, mintedSupply: minted, sellTokens: tokens, balanceTokens: held })
      : null;
  const canBuild = mode === "buy" ? Boolean(buyEstimate) : Boolean(sell?.ok);

  const resetOutcome = () => {
    setPreflight(null);
    setQuoteDrift(null);
    setPriceImpact(null);
  };

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
   * that is whenever the tab happened to be opened. See lib/ww/tradePlan.ts.
   *
   * The estimate above still comes from the mount-time read, deliberately: it
   * is a display, it says it is approximate, and re-fetching on every keystroke
   * would spend the RPC budget on people typing. What must be fresh is the
   * number that goes into the instruction.
   */
  const build = useCallback(async () => {
    if (!wallet || !battle || !canBuild) return null;
    const prep = await fetch("/api/ww/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
    }).then((r) => r.json());
    if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");

    const shownPool = battle.poolLamports[side];
    const readBattleState = async (): Promise<BattleState> => {
      const fresh = await readBattle(battleId);
      return { accounts: fresh.accounts, poolLamports: fresh.poolLamports, mintedSupply: fresh.mintedSupply };
    };
    const common = { battleId, trader: wallet, side, slippageBps, deadlineSeconds: DEADLINE_SECONDS, readBattleState };

    const plan =
      mode === "buy"
        ? await planBuy({ ...common, amountLamports: lamports })
        : await planSell({ ...common, amountTokens: tokens });
    setQuoteDrift(poolMoveBps(shownPool, plan.poolLamports));
    setPriceImpact(plan.priceImpact);
    return serializeMessage(wallet, prep.blockhash, [
      computeUnitLimitInstruction(COMPUTE_UNITS),
      computeUnitPriceInstruction(PRIORITY_MICRO_LAMPORTS),
      // Unconditionally, before the trade, on BOTH legs. The program does not
      // create the trader's token accounts, so a wallet's first trade in a
      // battle fails without these; they are idempotent, so including them when
      // the accounts already exist costs a few hundred compute units and nothing
      // else. A sell names both sides' accounts too, and a wallet that received
      // its tokens by transfer may hold one side without the other. The
      // alternative - read the accounts, include these only when absent - makes
      // the transaction depend on a fact that can stop being true between the
      // read and the signature.
      ...traderTokenAccountInstructions(battleId, wallet),
      plan.instruction,
    ]);
  }, [wallet, battle, canBuild, battleId, side, slippageBps, mode, lamports, tokens]);

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
        setConfirmation(res.confirmation ?? null);
        setPhase("done");
        // The pool and this wallet's balance both changed. Re-read rather than
        // predict: what landed is what the chain says landed.
        readBattle(battleId).then(setBattle).catch(() => undefined);
        if (wallet) refreshBalancesAfterTrade(wallet, balances).catch(() => undefined);
      } else {
        setError(res.error ?? "The trade was not sent.");
        setPhase("ready");
      }
    } catch (e) {
      setError(mapWalletError(e).message);
      setPhase("ready");
    }
  }, [provider, preflight, build, battleId, wallet, balances, refreshBalancesAfterTrade]);

  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper
      style={
        embedded
          ? { color: C.text, fontFamily: "inherit" }
          : { maxWidth: 460, margin: "40px auto", padding: "0 16px", color: C.text, fontFamily: "inherit" }
      }
    >
      {!embedded && (
        <>
          <p style={metaLabel}>WaveWarZ trade widget</p>
          <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>Battle {battleId}</h1>
          <p style={{ color: C.dim, fontSize: 13, margin: "0 0 18px" }}>
            Stage 1 reference implementation. Every trade is simulated against the program before you
            are asked to sign.
          </p>
        </>
      )}

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
        {wallet && balances && battle && balanceState !== "fresh" && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: balanceState === "waiting" ? C.dim : C.danger }}>
            {balanceState === "waiting"
              ? "Reading your new balance from chain..."
              : "Your balance has not changed on chain yet. It can take a few seconds; press Max again in a moment."}
          </p>
        )}
        {wallet && balances && battle && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            Holding A {balances.a.toLocaleString()} ({(shareOfSide(balances.a, battle.mintedSupply.a) * 100).toFixed(2)}% of side)
            {" / "}
            B {balances.b.toLocaleString()} ({(shareOfSide(balances.b, battle.mintedSupply.b) * 100).toFixed(2)}% of side)
          </p>
        )}
      </div>

      <div style={{ ...panel, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["buy", "sell"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                resetOutcome();
              }}
              style={{ ...button(mode === m ? "accent" : "plain"), flex: 1 }}
            >
              {m === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["a", "b"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSide(s);
                resetOutcome();
              }}
              style={{ ...button(side === s ? "accent" : "plain"), flex: 1 }}
            >
              Artist {s.toUpperCase()}
            </button>
          ))}
        </div>

        {mode === "buy" && (
          <>
            <label style={{ ...metaLabel, display: "block", marginBottom: 6 }}>Amount in SOL</label>
            <input
              value={amountSol}
              inputMode="decimal"
              onChange={(e) => {
                setAmountSol(e.target.value);
                resetOutcome();
              }}
              style={input}
            />
          </>
        )}

        {mode === "sell" && (
          <>
            <label style={{ ...metaLabel, display: "block", marginBottom: 6 }}>Tokens to sell</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={amountTokens}
                inputMode="numeric"
                placeholder={held !== null ? `up to ${held.toLocaleString()}` : "connect a wallet"}
                onChange={(e) => {
                  setAmountTokens(e.target.value.replace(/[^\d]/g, ""));
                  resetOutcome();
                }}
                style={{ ...input, flex: 1 }}
              />
              <button
                type="button"
                style={button("plain")}
                disabled={maxReading || held === null || held === 0}
                onClick={async () => {
                  // FILL FROM THE FRESH READ, NOT THE ONE ON SCREEN. The first
                  // version of this set the amount from `held` - state captured
                  // at render - and only then asked the chain, so the fresh
                  // answer landed in `balances` and never reached the input.
                  // Its own comment claimed the opposite of what it did. If the
                  // real balance had fallen, Max filled in tokens the wallet no
                  // longer had and the sell failed at the token program with an
                  // opaque error; if it had risen, Max quietly undersold.
                  resetOutcome();
                  if (!wallet) {
                    if (held !== null) setAmountTokens(String(held));
                    return;
                  }
                  setMaxReading(true);
                  try {
                    const fresh = await readBalances(wallet);
                    setBalances(fresh);
                    setBalanceState("fresh");
                    setAmountTokens(String(fresh[side]));
                  } catch {
                    // The read failed; fall back to what is on screen rather
                    // than clearing the box, and leave the state line alone.
                    if (held !== null) setAmountTokens(String(held));
                  } finally {
                    setMaxReading(false);
                  }
                }}
              >
                {maxReading ? "..." : "Max"}
              </button>
            </div>
            {wallet && held === 0 && (
              <p style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>
                This wallet holds nothing on Artist {side.toUpperCase()} in this battle.
              </p>
            )}
          </>
        )}

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
                resetOutcome();
              }}
              style={{ ...button(slippageBps === bps ? "accent" : "plain"), flex: 1 }}
            >
              {bps / 100}%
            </button>
          ))}
        </div>

        {buyEstimate && (
          <p style={{ color: C.dim, fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
            Estimated {Math.floor(buyEstimate.tokensOut).toLocaleString()} tokens.{" "}
            Fee {lamportsToSol(buyEstimate.feeLamports).toFixed(6)} SOL.
            <br />
            <span style={{ color: C.dim }}>
              An estimate from the curve, accurate to about 0.5%. The exact figure comes from the
              simulation below.
            </span>
          </p>
        )}

        {sell && sell.ok && (
          <p style={{ color: C.dim, fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
            You receive about {lamportsToSol(sell.quote.lamportsOut).toFixed(6)} SOL, before the
            network fee. Fee to artist and platform {lamportsToSol(sell.quote.feeLamports).toFixed(6)} SOL.
            <br />
            That is {(sell.shareOfSide * 100).toFixed(2)}% of the side's supply. The floor at{" "}
            {slippageBps / 100}% is {lamportsToSol(withSlippage(sell.quote.lamportsOut, slippageBps)).toFixed(6)} SOL;
            the program refuses to pay less.
            {sell.supplySource === "curve" && (
              <>
                <br />
                Priced off the curve, not the account, so it may read slightly high.
              </>
            )}
          </p>
        )}

        {sell && !sell.ok && tokens > 0 && (
          <p style={{ color: C.dim, fontSize: 12, marginTop: 12 }}>{sell.reason}</p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          style={{ ...button("plain"), flex: 1 }}
          disabled={!wallet || !battle || !canBuild || phase === "checking"}
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

      {priceImpact && (
        <div
          style={{
            ...panel,
            marginBottom: 12,
            borderColor: priceImpact.exceeded ? C.danger : C.grid,
          }}
        >
          <p style={{ ...metaLabel, marginBottom: 6, color: priceImpact.exceeded ? C.danger : C.dim }}>
            Price impact
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>{describePriceImpact(priceImpact)}</p>
          {!priceImpact.checked && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.dim }}>
              A maximum is set per asset in the approved asset registry (PRD 16), which is built
              but not yet maintained - so there is nothing to check against and this figure is
              shown rather than enforced.
            </p>
          )}
        </div>
      )}

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

      {signature && (() => {
        // THE COLOUR FOLLOWS THE CHAIN, NOT THE BROADCAST. Landed is green,
        // failed is red, unknown is neither: it is a true statement that we
        // could not tell yet, and it shows the signature so the person can.
        const tone = confirmation?.outcome === "landed" ? C.accent : confirmation?.outcome === "failed" ? C.danger : C.dim;
        const label = confirmation?.outcome === "landed" ? "Landed" : confirmation?.outcome === "failed" ? "Rejected on chain" : "Sent, not confirmed";
        return (
          <div style={{ ...panel, borderColor: tone }}>
            <p style={{ ...metaLabel, color: tone, marginBottom: 6 }}>{label}</p>
            {confirmation && <p style={{ margin: "0 0 6px", fontSize: 13 }}>{describeConfirmation(confirmation, signature)}</p>}
            <p style={{ margin: 0, fontSize: 12, fontFamily: C.mono, wordBreak: "break-all" }}>
              {signature}
            </p>
          </div>
        );
      })()}
    </Wrapper>
  );
}
