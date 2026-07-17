"use client";

import { C, metaLabel } from "@/lib/theme";

const OG_RESPECT = "0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957";
const ZOR_RESPECT = "0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c";
const OPTISCAN = "https://optimistic.etherscan.io/token/";

export default function FractalGovernance() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>ZAO FRACTAL GOVERNANCE</span>
        <p style={{ margin: "6px 0 0", color: C.text, lineHeight: 1.6, fontSize: 14, maxWidth: 680 }}>
          The ZAO runs a weekly <b>Fractal game</b> — members rank each other&apos;s contributions in
          small-group sessions, producing a consensus ranking weighted by earned Respect. Each
          cycle&apos;s Respect is settled on Optimism mainnet as on-chain tokens, making the DAO&apos;s
          full governance history publicly verifiable since July 2024.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Tile label="FRACTAL WEEKS" value="100+" sub="since Jul 30, 2024" />
        <Tile label="ON-CHAIN SETTLED" value="63 wks" sub="OG (33) + ZOR (31)" />
        <Tile label="RESPECT HOLDERS" value="157" sub="unique · OG ∪ ZOR" />
        <Tile label="OG SUPPLY" value="38,484" sub="Respect points issued" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={{ ...metaLabel, fontSize: 10 }}>RESPECT CONTRACTS — OPTIMISM MAINNET</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <ContractRow label="OG Respect (ERC-20)" address={OG_RESPECT} />
          <ContractRow label="ZOR Respect (ERC-1155)" address={ZOR_RESPECT} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ExLink href="https://thezao.com" label="thezao.com" />
        <ExLink href={`${OPTISCAN}${OG_RESPECT}`} label="OG Respect on Optimism" />
        <ExLink href={`${OPTISCAN}${ZOR_RESPECT}`} label="ZOR Respect on Optimism" />
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        Holders: 122 OG · 56 ZOR · 21 dual-holders → 157 unique. Settlement: 33 OG weeks (438 txs,
        2024-07-30 → 2025-12-20) + 31 ZOR weeks (67 txs, 2025-09-25 → 2026-07-06). Verified via
        Blockscout, Optimism mainnet, 2026-07-17. Source: ZAOOS docs 1200 · 1201 · 1202.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span
        style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}
      >
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function ContractRow({ label, address }: { label: string; address: string }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, minWidth: 180 }}>{label}</span>
      <a
        href={`${OPTISCAN}${address}`}
        target="_blank"
        rel="noreferrer"
        title={address}
        style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, textDecoration: "none" }}
      >
        {short} &#8599;
      </a>
    </div>
  );
}

function ExLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${C.grid}`,
        background: C.bg,
        color: C.text,
        textDecoration: "none",
      }}
    >
      {label} &#8599;
    </a>
  );
}
