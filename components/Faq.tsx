"use client";

import { C, metaLabel } from "@/lib/theme";
import { FLOOR_SOL } from "@/lib/config";

interface QA {
  q: string;
  a: string;
}

const FAQS: QA[] = [
  {
    q: "What is WaveWarZ?",
    a: "A decentralized music-battle platform on Solana. Two songs battle head-to-head; fans trade SOL on which side will win. Everything settles on-chain in native SOL.",
  },
  {
    q: "How do I bet on a battle?",
    a: "While a battle is live you buy shares of the side you back (the buyShares action) - SOL on a bonding curve, so the price rises as more is bought. You can sell back before the battle ends.",
  },
  {
    q: "How is the winner decided?",
    a: "Best 2 of 3: a community Poll, the Charts (which side drew more SOL volume), and DJ Wavy (an AI judge).",
  },
  {
    q: "Do I get paid automatically if I win?",
    a: "No - trader winnings must be claimed manually after the battle settles (the claimShares action). Artist payouts, by contrast, settle automatically.",
  },
  {
    q: "Is there a WaveWarZ token?",
    a: "No official platform token - the platform runs entirely on native SOL. Each battle mints two short-lived per-artist share tokens that exist only for that battle.",
  },
  {
    q: "How do artists earn?",
    a: "1% of trading volume per side on every trade, plus a settlement bonus - the winning artist gets 5% of the loser pool and the losing artist gets 2%.",
  },
  {
    q: `What is the ${FLOOR_SOL} SOL 'floor'?`,
    a: `The treasury wallet keeps roughly ${FLOOR_SOL} SOL as an operating floor; the founders periodically skim the excess above it. On-chain the treasury's lifetime net lands right around ${FLOOR_SOL} SOL.`,
  },
  {
    q: "When do battles happen?",
    a: "Quick Battles run live on weeknights around 8:30 PM EST (with a 30-second final trading window), plus community AMAs Monday-Friday around 11 AM EST, mainly on X Spaces and YouTube.",
  },
  {
    q: "What is DJ Wavy?",
    a: "The AI judge — one of the three scoring factors in V2 (Poll + Charts + DJ Wavy, best 2 of 3). DJ Wavy evaluates each battle and casts a binding vote. The exact model and criteria are not publicly disclosed by the team.",
  },
  {
    q: "What is The ZAO?",
    a: "The DAO that incubated WaveWarZ. The ZAO is a web3 music and creator collective — 100+ consecutive Fractal weeks of onchain governance, Respect-based contribution scores, and ZAO Improvement Proposals (ZIPs). WaveWarZ is the music-battle application layer at the top of the BCZ → The ZAO → WaveWarZ stack.",
  },
  {
    q: "Where does this dashboard's data come from?",
    a: "On-chain, via Dune queries over the WaveWarZ program (9TUf...g2fYo). It's an unofficial community tool, not financial advice. See the About and How It Works tabs.",
  },
];

export default function Faq() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / FAQ</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Quick answers to the common questions. Mechanics are from the on-chain
          program; schedule details from official channels.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FAQS.map((f) => (
          <section key={f.q} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: C.accent }}>{f.q}</h2>
            <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, fontSize: 14 }}>{f.a}</p>
          </section>
        ))}
      </div>

      <p style={{ ...metaLabel, fontSize: 11 }}>
        Unofficial community tool - not affiliated with WaveWarZ. Not financial advice.
      </p>
    </div>
  );
}
