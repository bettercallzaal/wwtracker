"use client";

import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";
import { usd } from "@/lib/price";
import { PROGRAM_ID as PROGRAM, TREASURY_WALLET as TREASURY } from "@/lib/config";

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-6)}`;

export default function AboutWaveWarZ() {
  const p = WW.program;
  const ps = WW.platformStats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / the brief</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          A decentralized music-battle platform on Solana. Artists go head-to-head
          song-vs-song; fans trade SOL on who wins. Everything settles in native
          SOL - there is no platform token. Each battle mints two ephemeral
          per-artist tokens on a bonding curve; you buy the side you back and claim
          winnings after settlement.
        </p>
      </header>

      {/* live on-chain snapshot */}
      <Section label="ON-CHAIN SNAPSHOT (DUNE)">
        <Grid>
          <Stat label="BATTLES" value={fmt(p.battlesCreated)} sub={`${fmt(p.battlesSettled)} settled`} />
          <Stat label="TRADES" value={fmt(p.buys + p.sells)} sub={`${fmt(p.buys)} buy / ${fmt(p.sells)} sell`} />
          <Stat label="CLAIMS" value={fmt(p.claims)} sub="winnings withdrawn" />
          <Stat label="UNIQUE TRADERS" value={fmt(p.uniqueTraders)} sub="distinct buyers" />
          {WW.volume.total > 0 && (
            <Stat label="BUY VOLUME" value={`${fmt(WW.volume.total)} ◎`} sub={usd(WW.volume.total)} />
          )}
          <Stat label="PROGRAM TXS" value={fmt(ps.programTxs)} sub={`${ps.activeDays} active days`} />
          <Stat label="TREASURY NET" value={`${fmt(ps.treasuryNet, 2)} ◎`} sub={`~the 3.5 floor - ${usd(ps.treasuryNet)}`} />
        </Grid>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
          since {ps.firstDay} - snapshot {WW.generatedAt}. On-chain vs the
          wavewarz.info app: {fmt(p.battlesCreated)} battles (app ~1,073);
          {WW.volume.total > 0 ? ` ${fmt(WW.volume.total)} ◎ buy volume (app 483.88 ◎, both sides).` : ""}
        </p>
      </Section>

      {/* how a battle works */}
      <Section label="HOW A BATTLE WORKS">
        <ol style={listStyle}>
          <li><b>initializeBattle</b> - a battle is created with two artists, a SOL vault, and two token mints.</li>
          <li><b>buyShares / sellShares</b> - fans trade SOL for the side they back on a bonding curve. Volume feeds the Charts score.</li>
          <li>Winner = best <b>2 of 3</b>: Poll (community vote) + Charts (SOL volume) + DJ Wavy (AI judge).</li>
          <li><b>endBattle</b> - settles; the loser pool is distributed.</li>
          <li><b>claimShares</b> - traders manually withdraw winnings.</li>
        </ol>
        <p style={{ ...metaLabel, fontSize: 11 }}>
          Formats: Quick Battles (nightly) and Main Events (catalog vs catalog).
        </p>
      </Section>

      {/* economics */}
      <Section label="ECONOMICS (PER IDL)">
        <table style={tableStyle}>
          <tbody>
            <Row k="Per trade - artist" v="1.0% of trade" />
            <Row k="Per trade - platform" v="0.5% of trade" />
            <Row k="Settlement - winning traders" v="40% of loser pool (pro-rata)" />
            <Row k="Settlement - losing traders refund" v="50% of loser pool" />
            <Row k="Settlement - winning artist" v="5% of loser pool" />
            <Row k="Settlement - losing artist" v="2% of loser pool" />
            <Row k="Settlement - platform" v="3% of loser pool" />
          </tbody>
        </table>
        <p style={{ ...metaLabel, fontSize: 11 }}>
          Platform revenue = 0.5% of every trade + 3% of every loser pool -&gt; the
          treasury wallet and its ~3.5 SOL operating floor.
        </p>
      </Section>

      {/* addresses */}
      <Section label="KEY ADDRESSES">
        <AddrRow label="Program" addr={PROGRAM} />
        <AddrRow label="Treasury / dev wallet" addr={TREASURY} />
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          FNj is the platform / team operations wallet - the team launches battles
          and trades with it, which is why it&apos;s the top program signer and
          shows up as the #5 &quot;trader&quot; (448W-154L) on the leaderboard. So
          its activity mixes platform ops with real trades. (Confirmed by the team.)
        </p>
      </Section>

      {/* team */}
      <Section label="TEAM">
        <ul style={listStyle}>
          <li><b>hurric4n3ike</b> (Ikechi Nwachukwu) - founder / lead developer. Also an artist.</li>
          <li><b>BetterCallZaal</b> (Zaal Panthaki) - cofounder, head of ecosystem. Founder of The ZAO.</li>
          <li><b>candy</b> (Samantha Kinney / CandyToyBox) - design, promo, marketing.</li>
        </ul>
      </Section>

      {/* ecosystem */}
      <Section label="ECOSYSTEM">
        <p style={{ margin: "0 0 8px", color: C.text, lineHeight: 1.6 }}>
          WaveWarZ is the music-battle application layer of <b>BCZ -&gt;{" "}
          <a href="https://thezao.com" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>The ZAO</a>
          {" "}-&gt; WaveWarZ</b> — The ZAO is a web3 music/creator collective with 100+ consecutive Fractal governance weeks and onchain Respect scores. Related
          surfaces in the ecosystem:
        </p>
        <ul style={listStyle}>
          <li><b>ZABAL</b> - streaming + coordination engine across the ecosystem.</li>
          <li><b>SongJam</b> (SANG) - leaderboard + Web2-to-Farcaster infra.</li>
          <li><b>ZAO Fractals</b> - weekly community governance ritual.</li>
        </ul>
        <p style={{ ...metaLabel, fontSize: 11 }}>
          Live programming: battles stream Mon-Fri ~8:30 PM EST on X Spaces / YouTube.
        </p>
      </Section>

      {/* links */}
      <Section label="OFFICIAL LINKS">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="https://www.wavewarz.com" label="wavewarz.com" />
          <Link href="https://wavewarz.info" label="wavewarz.info" />
          <Link href="https://x.com/WaveWarZ" label="X / @WaveWarZ" />
          <Link href="https://www.youtube.com/@WaveWarZ" label="YouTube" />
          <Link href="https://www.instagram.com/wavewarz" label="Instagram" />
          <Link href="https://thezao.com" label="thezao.com" />
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.grid}` }}>
      <td style={{ padding: "8px 10px 8px 0", color: C.dim }}>{k}</td>
      <td style={{ padding: "8px 0", textAlign: "right", color: C.text, fontVariantNumeric: "tabular-nums" }}>{v}</td>
    </tr>
  );
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.grid}`, flexWrap: "wrap" }}>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>{label}</span>
      <a
        href={`https://solscan.io/account/${addr}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: C.accent, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}
      >
        {short(addr)} &#8599;
      </a>
    </div>
  );
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: C.mono,
        fontSize: 13,
        padding: "8px 14px",
        borderRadius: 9,
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

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 };
