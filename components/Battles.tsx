"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS as S } from "@/lib/battles";
import { toCsv, downloadCsv } from "@/lib/csv";

interface Battle {
  id: string;
  type: "QUICK" | "MAIN" | "COMMUNITY";
  date: string;
  a: string;
  b: string;
  winner: string;
  margin: number | null;
  vol: number;
}

const fmt = (n: number, dp = 0) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
type Filter = "ALL" | "QUICK" | "MAIN" | "COMMUNITY";

function downloadBattlesCsv(rows: Battle[]) {
  const head = ["id", "type", "date", "a", "b", "winner", "margin", "vol"];
  const lines = rows.map((b) => [b.id, b.type, b.date, b.a, b.b, b.winner, b.margin ?? "", b.vol]);
  downloadCsv("wavewarz-battles.csv", toCsv(head, lines));
}

export default function Battles() {
  const [all, setAll] = useState<Battle[] | null>(null);
  const [skips, setSkips] = useState<Record<string, { skips: number; sol: number }>>({});
  const [queue, setQueue] = useState<Record<string, number>>({});
  const [wavySplit, setWavySplit] = useState<Record<string, { queue: number; wavy: number }>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setAll(d as Battle[]); })
      .catch(() => { if (alive) setAll([]); });
    fetch("/ww-skips.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setSkips(d as Record<string, { skips: number; sol: number }>); })
      .catch(() => {});
    fetch("/ww-queue.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setQueue(d as Record<string, number>); })
      .catch(() => {});
    fetch("/ww-wavysplit.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setWavySplit(d as Record<string, { queue: number; wavy: number }>); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Battles + songs per night (from the dates). Songs = distinct titles in quick
  // battles that night; battles = all battle types that night.
  const perNightAll = useMemo(() => {
    if (!all) return [];
    const map = new Map<string, { battles: number; songs: Set<string> }>();
    for (const b of all) {
      const e = map.get(b.date) ?? { battles: 0, songs: new Set<string>() };
      e.battles += 1;
      if (b.type === "QUICK") { e.songs.add(b.a); e.songs.add(b.b); }
      map.set(b.date, e);
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    return [...map.entries()]
      .map(([date, v]) => {
        const d = new Date(Date.parse(date));
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const sp = wavySplit[iso];
        const combined = queue[iso] ?? 0; // total 0.005 inflows = queue + DJ Wavy
        return {
          date,
          short: date.replace(/, \d{4}$/, ""),
          battles: v.battles,
          songs: v.songs.size,
          skips: skips[iso]?.skips ?? 0,
          queue: sp ? sp.queue : combined, // when split known, just queue; else combined
          djwavy: sp ? sp.wavy : null, // null = not yet classified for this night
          ts: Date.parse(date),
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [all, skips, queue, wavySplit]);

  const hasSplit = useMemo(() => Object.keys(wavySplit).length > 0, [wavySplit]);

  const perNight = useMemo(() => [...perNightAll].reverse().slice(0, 14), [perNightAll]);
  const latest = perNightAll[perNightAll.length - 1];
  const prior = perNightAll[perNightAll.length - 2];
  const battleDelta = latest && prior ? latest.battles - prior.battles : 0;
  const skipDelta = latest && prior ? latest.skips - prior.skips : 0;
  const totals = useMemo(() => {
    const totalSkips = Object.values(skips).reduce((s, v) => s + v.skips, 0);
    const skipRevenue = Object.values(skips).reduce((s, v) => s + v.sol, 0);
    const totalQueue = Object.values(queue).reduce((s, v) => s + v, 0);
    const splitQueue = Object.values(wavySplit).reduce((s, v) => s + v.queue, 0);
    const splitWavy = Object.values(wavySplit).reduce((s, v) => s + v.wavy, 0);
    return { totalSkips, skipRevenue, totalQueue, splitQueue, splitWavy };
  }, [skips, queue, wavySplit]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((b) => {
      if (filter !== "ALL" && b.type !== filter) return false;
      if (!needle) return true;
      return `${b.a} ${b.b} ${b.winner}`.toLowerCase().includes(needle);
    });
  }, [all, q, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / battles</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          The full battle history - {all ? fmt(all.length) : fmt(S.totalShown)} battles, all
          time. Search by song or artist, filter by type.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Tile label="TOTAL BATTLES" value={fmt(S.totalShown)} sub="all time" />
        <Tile label="QUICK BATTLES" value={fmt(S.quickBattles)} sub="song vs song" />
        <Tile label="MAIN EVENTS" value={fmt(S.events)} sub={`${S.multiRound} multi-round`} />
        <Tile label="TOTAL VOLUME" value={`${fmt(S.totalVolumeSol, 1)} ◎`} sub="SOL traded" />
        <Tile label="ARTIST PAYOUTS" value={`${fmt(S.artistPayoutsSol, 2)} ◎`} sub="to artists" />
      </div>

      {/* per night */}
      {perNight.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          {latest && prior && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <span style={{ ...metaLabel, fontSize: 10 }}>LATEST NIGHT ({latest.short})</span>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {latest.battles} battles{" "}
                  <span style={{ fontSize: 13, color: battleDelta >= 0 ? C.good : C.danger, fontFamily: C.mono }}>
                    {battleDelta >= 0 ? "+" : ""}{battleDelta} vs prior
                  </span>
                </div>
                <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>{latest.songs} songs - {latest.skips} skips </span>
                <span style={{ fontSize: 11, color: skipDelta >= 0 ? C.good : C.danger, fontFamily: C.mono }}>({skipDelta >= 0 ? "+" : ""}{skipDelta})</span>
              </div>
              <div>
                <span style={{ ...metaLabel, fontSize: 10 }}>NIGHT BEFORE ({prior.short})</span>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{prior.battles} battles</div>
                <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>{prior.songs} songs - {prior.skips} skips</span>
              </div>
            </div>
          )}
          <div style={{ height: 180, marginBottom: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perNightAll.slice(-40)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: C.dim, fontSize: 10, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={28} />
                <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: C.mono }} tickLine={false} axisLine={false} width={26} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(255,194,75,0.08)" }} contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }} labelStyle={{ color: C.dim }} formatter={(v: number | string, n) => [v, n]} />
                <Bar dataKey="battles" fill={C.accent} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(totals.totalSkips > 0 || totals.totalQueue > 0) && (
            <>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10, fontFamily: C.mono, fontSize: 12, color: C.dim }}>
                <span>total skips: <b style={{ color: C.good }}>{fmt(totals.totalSkips)}</b> ({fmt(totals.skipRevenue, 2)} ◎)</span>
                {hasSplit ? (
                  <>
                    <span>queue: <b style={{ color: C.text }}>{fmt(totals.splitQueue)}</b></span>
                    <span>DJ Wavy: <b style={{ color: C.accent }}>{fmt(totals.splitWavy)}</b> <span style={{ fontSize: 10 }}>(classified nights)</span></span>
                  </>
                ) : (
                  <span>total queue+wavy: <b style={{ color: C.text }}>{fmt(totals.totalQueue)}</b></span>
                )}
              </div>
              <div style={{ height: 160, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perNightAll.slice(-40)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="short" tick={{ fill: C.dim, fontSize: 10, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={28} />
                    <YAxis tick={{ fill: C.dim, fontSize: 10, fontFamily: C.mono }} tickLine={false} axisLine={false} width={26} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(255,194,75,0.08)" }} contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }} labelStyle={{ color: C.dim }} />
                    <Bar dataKey="skips" name="skips" fill={C.good} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="queue" name="queue" fill={C.accentDim} fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                    {hasSplit && <Bar dataKey="djwavy" name="DJ Wavy" fill={C.accent} fillOpacity={0.9} radius={[2, 2, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...metaLabel, fontSize: 10, marginBottom: 10 }}>
                {hasSplit ? "skips (green) + queue (dim) + DJ Wavy (amber) per night" : "skips (green) + queue/wavy (amber) per night"}
              </div>
            </>
          )}
          <div style={{ marginBottom: 12 }}><span style={metaLabel}>PER NIGHT (LAST 14 ACTIVE DATES)</span></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12, minWidth: 360 }}>
              <thead><tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={{ padding: "6px 10px" }}>NIGHT</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>BATTLES</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>SONGS</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>SKIPS</th>
                {hasSplit ? (
                  <>
                    <th style={{ padding: "6px 10px", textAlign: "right" }}>QUEUE</th>
                    <th style={{ padding: "6px 10px", textAlign: "right" }}>DJ WAVY</th>
                  </>
                ) : (
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Q+WAVY</th>
                )}
              </tr></thead>
              <tbody>
                {perNight.map((n) => (
                  <tr key={n.date} style={{ borderTop: `1px solid ${C.grid}` }}>
                    <td style={{ padding: "6px 10px" }}>{n.date}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: C.accent }}>{n.battles}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{n.songs}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: C.good }}>{n.skips || "-"}</td>
                    {hasSplit ? (
                      <>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: C.dim }}>{n.queue || "-"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: n.djwavy == null ? C.dim : C.accent }}>{n.djwavy == null ? "·" : n.djwavy || "-"}</td>
                      </>
                    ) : (
                      <td style={{ padding: "6px 10px", textAlign: "right", color: C.dim }}>{n.queue || "-"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>Songs = distinct quick-battle titles that night. Skips = direct transfers to the platform wallet on the escalating skip ladder (0.02 SOL, +0.01 each concurrent skip), from Dune. Queue + DJ Wavy are both 0.005 SOL to the platform wallet, so price can&apos;t tell them apart - {hasSplit ? "but a DJ Wavy tx ALSO sends a second transfer to another wallet (the compared artist), so they're split here on that signal. The 0.005 feature began ~Nov 2025; some Feb-Apr 2026 nights are unclassified (· ) pending more Dune credits." : "they're shown combined until the on-chain split lands."} From Dune.</p>
        </section>
      )}

      {/* search + filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(40); }}
          placeholder="search song or artist..."
          aria-label="Search battles"
          style={{ flex: 1, minWidth: 200, fontFamily: C.mono, fontSize: 13, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.grid}`, background: C.bg, color: C.text }}
        />
        {(["ALL", "QUICK", "MAIN", "COMMUNITY"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setLimit(40); }}
            style={{ fontFamily: C.mono, fontSize: 11, padding: "8px 12px", borderRadius: 9, cursor: "pointer", border: `1px solid ${filter === f ? C.accent : C.grid}`, background: filter === f ? C.accent : "transparent", color: filter === f ? "#1a1206" : C.text }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ ...metaLabel, fontSize: 11 }}>{fmt(filtered.length)} battles{q ? ` matching "${q}"` : ""}</span>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => downloadBattlesCsv(filtered)}
            style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 11, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.grid}`, background: C.panel, color: C.text }}
          >
            download CSV
          </button>
        )}
      </div>

      {all === null ? (
        <div className="skeleton-shimmer" style={{ height: 300, borderRadius: 16 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.slice(0, limit).map((b) => (
            <a key={b.id} href={`https://wavewarz.info/battles/${b.id}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", textDecoration: "none", background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: b.type === "QUICK" ? C.dim : C.accent, minWidth: 64 }}>{b.type}</span>
              <span style={{ flex: 1, minWidth: 180, fontSize: 14, color: C.text }}>
                <b style={{ color: b.winner === b.a ? C.good : C.text }}>{b.a}</b>
                <span style={{ color: C.dim }}> vs </span>
                <b style={{ color: b.winner === b.b ? C.good : C.text }}>{b.b}</b>
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                {b.vol > 0 ? `${fmt(b.vol, 3)} ◎` : ""}{b.margin != null ? ` +${b.margin}%` : ""} - {b.date}
              </span>
            </a>
          ))}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + 60)}
              style={{ marginTop: 6, alignSelf: "center", fontFamily: C.mono, fontSize: 13, padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.grid}`, background: C.panel, color: C.accent, cursor: "pointer" }}>
              show more ({fmt(filtered.length - limit)} left)
            </button>
          )}
        </div>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Full feed scraped from wavewarz.info via paginated render (949/958 battles
        parsed). Winners in green. Rows link to the battle detail. Snapshot
        2026-06-15.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}
