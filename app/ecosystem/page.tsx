import type { Metadata } from "next";
import { C, metaLabel } from "@/lib/theme";

export const metadata: Metadata = {
  title: "The WaveWarZ ecosystem - wwtracker",
  description:
    "Every surface, product and repo in the WaveWarZ ecosystem, who owns what, and which claims are measured against Solana mainnet rather than described.",
  openGraph: {
    title: "The WaveWarZ ecosystem",
    description:
      "Products, arenas, the protocol layer, identity, and who owns what. Measured, with sample sizes.",
    url: "https://wwtracker.vercel.app/ecosystem",
    siteName: "wwtracker",
    type: "article",
  },
};

const MEASURED = "2026-09-06";

interface Row {
  name: string;
  what: string;
  chain?: string;
  owner?: string;
  status: string;
  href?: string;
}

const PRODUCTS: Row[] = [
  {
    name: "WaveWarZ",
    what: "Two songs go head to head for a fixed window. Fans trade SOL on a square-root bonding curve on who wins. Settles on chain, no platform token.",
    chain: "Solana",
    owner: "Hurricane",
    status: "Live since 2025-05-26. 1,643 battles.",
    href: "https://wavewarz.com",
  },
  {
    name: "WaveZStation",
    what: "Fans pay what they want into a song's pool. Every sale splits 45% to the fan pool, 45% to the artist and collaborators, 10% to the platform, and earlier supporters earn when later fans buy the same song.",
    chain: "Base, in USDC",
    owner: "Same team, separate product",
    status: "Live since 2026-07-26. 244 USDC gross, 8 songs, 6 artists.",
    href: "https://www.wavezstation.com",
  },
  {
    name: "wavewarz.info",
    what: "The record layer. Indexes Solana into Supabase, runs admin judging, owns the canonical Battle ID, and serves the public API partners read.",
    owner: "Candy",
    status: "Live. 1,594 battle rows, 10,371 trades, 52 artist profiles.",
    href: "https://wavewarz.info",
  },
  {
    name: "wwtracker",
    what: "The lab. Analytics, 17 read-only embeds, the business layer, and now a live battle positions page reading chain directly.",
    owner: "Zaal",
    status: "Live.",
    href: "https://wwtracker.vercel.app",
  },
];

const ARENAS: Row[] = [
  {
    name: "wavewarz.com",
    what: "Operator zero. Every battle in history was originated here.",
    status: "Live. 100% of 1,643 battles.",
  },
  {
    name: "$ongChainn / WaveWarZ Africa",
    what: "The reference arena. Audience-first music streaming on Base and Farcaster - it brings artists, catalogue and audience, not a battle engine. Identity crosses via Farcaster's verified Solana addresses, so the battle never leaves Solana.",
    chain: "Base and Farcaster",
    owner: "Iman Afrikah",
    status: "Proposed. Integration path measured, nothing built.",
    href: "https://www.songchainn.xyz",
  },
  {
    name: "Ather Music",
    what: "Named as the reference integration in the PRD. Still a target, no longer the first case study.",
    status: "Proposed.",
  },
];

const LAYERS: Row[] = [
  {
    name: "WBS-1",
    what: "The standard. What makes a battle countable, what a record must carry, how an artist and a track are identified across arenas, and how an operator registers.",
    status: "Drafted. 78 PRD sections mapped to live, measured, buildable, decision or contract.",
  },
  {
    name: "wavewarz-protocol",
    what: "Ground truth about the Solana program, established by reading mainnet rather than reading documents. Every claim carries its sample size.",
    owner: "Zaal",
    status: "Private until the upgrade authority moves to a multisig.",
  },
  {
    name: "WavID",
    what: "Verifiable creative history as a persistent visual identity, and the Proof of Creative History model underneath it. The evidence hierarchy the artist-identity spec now sits under.",
    owner: "Concept by OxQuan, formalised by REGALIA//89",
    status: "Research paper, not a shipped feature.",
  },
];

function Table({ rows, title, note }: { rows: Row[]; title: string; note?: string }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px", letterSpacing: 0.3 }}>{title}</h2>
      {note && <p style={{ ...metaLabel, margin: "0 0 14px" }}>{note}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.name} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{r.name}</h3>
              {r.href && (
                <a href={r.href} target="_blank" rel="noreferrer"
                   style={{ color: C.accent, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}>
                  visit &#8599;
                </a>
              )}
            </div>
            <p style={{ margin: "8px 0 10px", color: C.text, lineHeight: 1.6, fontSize: 14 }}>{r.what}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", ...metaLabel, fontSize: 11 }}>
              {r.chain && <span>CHAIN: {r.chain}</span>}
              {r.owner && <span>OWNER: {r.owner}</span>}
              <span>STATUS: {r.status}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function EcosystemPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 72px", color: C.text }}>
      <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 0.4 }}>THE WAVEWARZ ECOSYSTEM</h1>
      <p style={{ color: C.dim, marginTop: 8, lineHeight: 1.65 }}>
        Every surface we touch, who owns it, and what is actually true about it. Figures
        are measured against Solana mainnet on {MEASURED} and carry their sample size.
        Where something is proposed rather than built, it says so.
      </p>

      <Table title="PRODUCTS" rows={PRODUCTS}
        note="Two products, two chains, one set of artists moving between them." />

      <Table title="ARENAS" rows={ARENAS}
        note="An arena brings artists, audience and an interface. It never brings a battle engine, a settlement path, or an artist-id scheme of its own." />

      <Table title="THE STANDARD AND THE RECORD" rows={LAYERS} />

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 10px", letterSpacing: 0.3 }}>WHO OWNS WHAT</h2>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.65 }}>
          Equal thirds, and the work divides along what each person already holds.
          Hurricane holds wavewarz.com, the Solana program and the upgrade key, so the
          battle engine and anything touching the contract is his. Candy holds
          wavewarz.info, the indexer, the canonical Battle ID and the public API, so the
          record is hers. Zaal holds wwtracker, the embeds and the protocol repo, so the
          standard and the integration surface are his.
        </p>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 10px", letterSpacing: 0.3 }}>WHAT IS MEASURED</h2>
        <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.65, marginTop: 0 }}>
          The program has no public source and no published IDL, so everything below was
          recovered by reading mainnet. Each figure is reproducible with a public RPC and
          no account.
        </p>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {[
            ["Battle accounts on chain", "1,643"],
            ["Instruction set recovered", "all six, derivable from their names"],
            ["Bonding curve", "supply = sqrt(4.993e8 x pool)"],
            ["Trade fee", "1.500%, split 67/33 between artist and platform"],
            ["Settlement", "winner pool + 40% of loser pool, 1,506 of 1,506"],
            ["Launch fees", "not collected - creating a battle costs the creator"],
            ["Battles that are one artist's two tracks", "430 of 1,643"],
            ["Distinct artist wallets, ever", "120"],
            ["Battles originated outside wavewarz.com", "0"],
          ].map(([k, v]) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between", gap: 12,
              padding: "8px 12px", background: C.panel, borderRadius: 10, fontSize: 14,
            }}>
              <span style={{ color: C.dim }}>{k}</span>
              <span style={{ fontFamily: C.mono, color: C.text }}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6, marginTop: 32 }}>
        Measured {MEASURED}. Volume figures quoted anywhere include treasury seeding -
        the platform buys into battles to provide a starting price, which is visible on
        chain and is market-making rather than betting. Anything describing community
        demand should exclude it.
      </p>
    </main>
  );
}
