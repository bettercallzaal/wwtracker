"use client";

import { useEffect, useState } from "react";
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
import { launchBattleInstructions } from "@/lib/ww/instructions";
import { computeUnitLimitInstruction, serializeMessage } from "@/lib/ww/message";
import { battlePda, mintPda, vaultPda } from "@/lib/ww/pda";
import { canAfford, checkLaunch, launchCost, LAUNCH_ACCOUNTS, type LaunchCost } from "@/lib/ww/launchPlan";
import { TREASURY_WALLET } from "@/lib/config";

/**
 * Create a battle of our own, from our own UI.
 *
 * WHY IT CAN EXIST. `initializeBattle` takes a signer named `admin`, and every
 * battle on chain was created by the platform treasury - which says nothing
 * about whether anyone else may. Simulated 2026-09-24 from a wallet that is
 * not the treasury, against a fresh id: the program logged `Battle
 * initialized` and `Mints initialized` and would have succeeded. **The program
 * is permissionless for launching.**
 *
 * LAUNCHING IS TWO INSTRUCTIONS AND THIS SENDS BOTH IN ONE TRANSACTION.
 * `initializeBattle` alone leaves a battle nobody can trade, because the mints
 * a buy needs do not exist yet - an afternoon was lost to that once. One
 * transaction means they cannot land apart.
 *
 * THE COST IS SHOWN BEFORE THE WALLET IS ASKED, and it is shown as what it is:
 * rent on four accounts that no instruction ever closes, so it is spent and
 * not returned. The figures come from `launchPlan.ts`, the same module the
 * dry-run script uses, so the screen and the terminal cannot disagree.
 */
type Phase = "idle" | "preflighting" | "ready" | "signing" | "sending" | "sent" | "error";

const SOL = (lamports: number) => (lamports / 1e9).toFixed(6);

export default function LaunchBattle() {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [artistA, setArtistA] = useState("");
  const [artistB, setArtistB] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [startsInMinutes, setStartsInMinutes] = useState("5");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<LaunchCost | null>(null);
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [launched, setLaunched] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

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
      onAccountChanged: (key) => {
        setWallet(key);
        // A preflight built for the old key is a claim about a transaction
        // nobody built. Clearing it matters more than clearing the address.
        setCost(null);
        setBalanceLamports(null);
        setPhase("idle");
      },
      onDisconnect: () => {
        setWallet(null);
        setCost(null);
        setPhase("idle");
      },
    });
  }, [provider]);

  /** The id IS the start time, so it is derived once per attempt, not stored. */
  const battleIdFor = () =>
    Math.floor(Date.now() / 1000) + Math.round(Number(startsInMinutes || "0") * 60);
  const durationSeconds = () => Math.round(Number(durationMinutes || "0") * 60);

  async function relay(body: Record<string, unknown>) {
    const res = await fetch("/api/ww/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !json.status) throw new Error(`relay: HTTP ${res.status}`);
    return json;
  }

  async function buildAndPreflight() {
    setError(null);
    setSignature(null);
    setLogs([]);
    setPhase("preflighting");
    try {
      const provider0 = provider ?? detectPhantom();
      if (!provider0) throw new Error("no wallet found: install Phantom, or unlock it");
      const conn = wallet ? { publicKey: wallet } : await connect(provider0);
      // `connect` returns null when the wallet declines. Treating that as a
      // connection would build a transaction for the string "undefined".
      if (!conn?.publicKey) throw new Error("the wallet did not connect");
      const creator = conn.publicKey;
      setWallet(creator);

      const battleId = battleIdFor();
      const params = {
        battleId,
        durationSeconds: durationSeconds(),
        artistA: artistA.trim(),
        artistB: artistB.trim(),
      };
      // The same checker the dry-run script uses, so a shape refused on the
      // terminal cannot be accepted here.
      const check = checkLaunch(params, Math.floor(Date.now() / 1000));
      if (!check.ok) throw new Error(check.reason);

      const prep = await relay({ action: "prepare" });
      if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");

      const ixs = [
        computeUnitLimitInstruction(400_000),
        ...launchBattleInstructions({
          battleId,
          creator,
          artistA: params.artistA,
          artistB: params.artistB,
          wavewarzWallet: TREASURY_WALLET,
          durationSeconds: params.durationSeconds,
        }),
      ];
      const message = serializeMessage(creator, prep.blockhash, ixs);
      const unsigned = unsignedTransaction(message);

      const res = await relay({
        action: "preflight",
        transaction: Buffer.from(unsigned).toString("base64"),
      });
      if (res.status !== "ok" || res.wouldSucceed === false) {
        setLogs(Array.isArray(res.logs) ? res.logs : []);
        throw new Error(res.error ?? res.reason ?? "the program refused this launch");
      }
      setLogs(Array.isArray(res.logs) ? res.logs : []);

      // Cost AFTER the program agreed it would work. Quoting a price for
      // something that cannot happen is worse than quoting none.
      const rentFor = new Map<number, number>();
      for (const { bytes } of LAUNCH_ACCOUNTS) {
        if (rentFor.has(bytes)) continue;
        const r = await relay({ action: "rent", bytes });
        if (r.status !== "ok" || typeof r.lamports !== "number") {
          throw new Error(`could not price the ${bytes}-byte account, so the total would be wrong`);
        }
        rentFor.set(bytes, r.lamports);
      }
      const feeRes = await relay({ action: "fee", message: Buffer.from(message).toString("base64") });
      setCost(launchCost(rentFor, typeof feeRes?.lamports === "number" ? feeRes.lamports : null));

      const balRes = await relay({ action: "balance", address: creator });
      setBalanceLamports(typeof balRes?.lamports === "number" ? balRes.lamports : null);

      setLaunched(battleId);
      setPhase("ready");
    } catch (e) {
      setError(mapWalletError(e).message);
      setPhase("error");
    }
  }

  async function signAndSend() {
    if (!launched) return;
    setError(null);
    setPhase("signing");
    try {
      const provider0 = provider ?? detectPhantom();
      if (!provider0) throw new Error("no wallet found");
      const creator = wallet;
      if (!creator) throw new Error("no wallet connected");

      // Rebuilt against a FRESH blockhash rather than reusing the preflight's:
      // a blockhash ages out while somebody reads a cost breakdown, and a
      // signature over a stale one is refused at the last possible moment.
      const prep = await relay({ action: "prepare" });
      if (prep.status !== "ok") throw new Error(prep.error ?? "could not get a blockhash");
      const ixs = [
        computeUnitLimitInstruction(400_000),
        ...launchBattleInstructions({
          battleId: launched,
          creator,
          artistA: artistA.trim(),
          artistB: artistB.trim(),
          wavewarzWallet: TREASURY_WALLET,
          durationSeconds: durationSeconds(),
        }),
      ];
      const message = serializeMessage(creator, prep.blockhash, ixs);
      // signMessage wraps the message in an unsigned transaction itself; passing
      // one in would wrap it twice and the wallet would sign the wrong bytes.
      const sig = await signMessage(provider0, message);
      setPhase("sending");
      // Message first, signature second. Reversed, this compiles only because
      // both are "the transaction" in prose and neither is in the type system.
      const tx = assembleSignedTransaction(message, sig);
      const res = await relay({ action: "send", transaction: Buffer.from(tx).toString("base64") });
      if (res.status !== "sent") throw new Error(res.error ?? res.reason ?? "the send was refused");
      setSignature(res.signature);
      setPhase("sent");
    } catch (e) {
      setError(mapWalletError(e).message);
      setPhase("error");
    }
  }

  const input = {
    width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6,
    border: `1px solid ${C.grid}`, background: "transparent", color: C.text, marginBottom: 10,
  } as const;
  const button = {
    padding: "10px 16px", fontSize: 14, fontWeight: 600, borderRadius: 6,
    border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer",
  } as const;

  const afford = cost && balanceLamports !== null ? canAfford(balanceLamports, cost) : null;

  return (
    <div>
      <p style={{ ...metaLabel, marginBottom: 10 }}>Launch a battle</p>

      <label style={{ fontSize: 12, color: C.dim }}>Artist A wallet</label>
      <input style={input} value={artistA} onChange={(e) => setArtistA(e.target.value)} placeholder="base58 address" />
      <label style={{ fontSize: 12, color: C.dim }}>Artist B wallet</label>
      <input style={input} value={artistB} onChange={(e) => setArtistB(e.target.value)} placeholder="base58 address" />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: C.dim }}>Starts in (minutes)</label>
          <input style={input} value={startsInMinutes} onChange={(e) => setStartsInMinutes(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: C.dim }}>Runs for (minutes)</label>
          <input style={input} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </div>
      </div>

      <button type="button" style={button} onClick={() => void buildAndPreflight()} disabled={phase === "preflighting"}>
        {phase === "preflighting" ? "checking with the program..." : "Check this launch"}
      </button>

      {launched && phase !== "error" && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.dim }}>
          <p style={{ margin: "0 0 6px" }}>
            battle id <strong style={{ color: C.text }}>{launched}</strong>, which IS its start time:{" "}
            {new Date(launched * 1000).toLocaleString()}
          </p>
          <p style={{ margin: "0 0 2px" }}>battle {battlePda(launched)}</p>
          <p style={{ margin: "0 0 2px" }}>vault {vaultPda(launched)}</p>
          <p style={{ margin: "0 0 2px" }}>mint a {mintPda(launched, "a")}</p>
          <p style={{ margin: 0 }}>mint b {mintPda(launched, "b")}</p>
        </div>
      )}

      {cost && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <p style={{ ...metaLabel, marginBottom: 6 }}>What you pay</p>
          {cost.lines.map((l) => (
            <p key={l.name} style={{ margin: "0 0 2px", color: C.dim }}>
              {l.name} ({l.bytes} bytes) {SOL(l.lamports)} SOL
            </p>
          ))}
          <p style={{ margin: "0 0 2px", color: C.dim }}>
            network fee{" "}
            {cost.networkFeeLamports === null ? "UNKNOWN" : `${SOL(cost.networkFeeLamports)} SOL`}
          </p>
          <p style={{ margin: "6px 0 0", color: C.text, fontWeight: 600 }}>
            total {SOL(cost.totalLamports)} SOL{cost.isFloor ? " (a FLOOR: the fee is unknown)" : ""}
          </p>
          <p style={{ margin: "6px 0 0", color: C.dim }}>
            This is rent on four accounts. Nothing closes them, so it does not come back.
          </p>
          <p style={{ margin: "4px 0 0", color: C.dim }}>
            you can afford it: {afford === null ? "UNKNOWN" : afford ? "yes" : "NO"}
            {balanceLamports !== null ? ` (balance ${SOL(balanceLamports)} SOL)` : " (balance UNKNOWN)"}
          </p>
        </div>
      )}

      {phase === "ready" && (
        <button type="button" style={{ ...button, marginTop: 12 }} onClick={() => void signAndSend()}>
          Sign and launch
        </button>
      )}
      {(phase === "signing" || phase === "sending") && (
        <p style={{ marginTop: 12, fontSize: 13, color: C.dim }}>
          {phase === "signing" ? "waiting for the wallet..." : "sending..."}
        </p>
      )}
      {phase === "sent" && signature && (
        <>
          <p style={{ marginTop: 12, fontSize: 13, color: C.text }}>
            Sent. Signature <span style={{ color: C.accent }}>{signature}</span>. Sent is not landed - open the
            battle page to see it on chain.
          </p>
          {/*
            THE NAMES ARE THE NEXT STEP AND NOBODY WOULD REMEMBER THEM.
            wavewarz.info only indexes battles it created, so this one renders
            as "A" versus "B" until it is in data/community-battles.json. The
            entry is printed here, filled in, rather than left as a thing to
            look up later - which is when it would not happen.
          */}
          <p style={{ marginTop: 12, fontSize: 12, color: C.dim }}>
            This battle has no names yet. wavewarz.info does not index battles it did not create, so
            it will render as A versus B until you add this to{" "}
            <code>data/community-battles.json</code> and commit it:
          </p>
          <pre
            style={{
              marginTop: 6,
              padding: 10,
              fontSize: 11,
              color: C.text,
              background: C.elev,
              borderRadius: 6,
              overflowX: "auto",
            }}
          >
{`"${launched}": {
  "title": "",
  "host": "",
  "a": { "artist": "", "track": "" },
  "b": { "artist": "", "track": "" }
}`}
          </pre>
          <p style={{ marginTop: 4, fontSize: 12, color: C.dim }}>
            Both sides need an artist name. A half-filled entry is refused on purpose: one real name
            beside a blank reads as an artist who has none.
          </p>
        </>
      )}
      {error && (
        <p style={{ marginTop: 12, fontSize: 13, color: C.accent }}>NOT LAUNCHED: {error}</p>
      )}
      {logs.length > 0 && (
        <pre style={{ marginTop: 10, fontSize: 11, color: C.dim, whiteSpace: "pre-wrap" }}>
          {logs.join("\n")}
        </pre>
      )}
    </div>
  );
}
