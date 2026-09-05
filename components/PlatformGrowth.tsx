"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";

interface VolDay {
  date: string;
  vol: number;
  battles: number;
}

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

interface MonthStat {
  month: string;   // "2025-05"
  label: string;   // "May '25"
  battles: number;
  vol: number;
}

interface DayStat {
  label: string;
  battles: number;
  vol: number;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDayStats(battles: { date?: string; vol?: number }[]): DayStat[] {
  const acc: { battles: number; vol: number }[] = Array.from({ length: 7 }, () => ({ battles: 0, vol: 0 }));
  for (const b of battles) {
    if (!b.date) continue;
    const dt = new Date(Date.parse(b.date));
    if (isNaN(dt.getTime())) continue;
    // getDay() returns 0=Sun, so remap to 0=Mon..6=Sun
    const idx = (dt.getDay() + 6) % 7;
    acc[idx].battles += 1;
    acc[idx].vol += b.vol ?? 0;
  }
  return acc.map((v, i) => ({ label: DOW_LABELS[i], ...v }));
}

function toMonthStats(battles: { date?: string; vol?: number }[]): MonthStat[] {
  const map = new Map<string, { battles: number; vol: number }>();
  for (const b of battles) {
    if (!b.date) continue;
    const dt = new Date(Date.parse(b.date));
    if (isNaN(dt.getTime())) continue;
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const e = map.get(ym) ?? { battles: 0, vol: 0 };
    e.battles += 1;
    e.vol += b.vol ?? 0;
    map.set(ym, e);
  }
  const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v]) => {
      const [yr, mo] = ym.split("-");
      return { month: ym, label: `${SHORT_MONTH[Number(mo) - 1]} '${yr.slice(2)}`, ...v };
    });
}

export default function PlatformGrowth() {
  const [days, setDays] = useState<VolDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthStats, setMonthStats] = useState<MonthStat[] | null>(null);
  const [dayStats, setDayStats] = useState<DayStat[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-platform-volume.json")
      .then((r) => r.json())
      .then((d: VolDay[]) => alive && setDays(d))
      .catch(() => alive && setError("Could not load platform volume."));
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((d: { date?: string; vol?: number }[]) => {
        if (!alive) return;
        setMonthStats(toMonthStats(d));
        setDayStats(toDayStats(d));
      })
      .catch(() => { if (alive) { setMonthStats([]); setDayStats([]); } });
    return () => {
      alive = false;
    };
  }, []);

  // Volume series: cumulative vol over time (not estimated - WaveWarZ API is authoritative
  // per-battle volume: artist1.volumeSol + artist2.volumeSol summed by day).
  const data = useMemo(() => {
    if (!days) return null;
    let cum = 0;
    let battlesCum = 0;
    const series = days.map((d) => {
      cum += d.vol;
      battlesCum += d.battles;
      return {
        date: d.date,
        daily: Math.round(d.vol * 1000) / 1000,
        cum: Math.round(cum * 1000) / 1000,
        battles: d.battles,
      };
    });
    const total = cum;
    const totalBattles = battlesCum;
    const peak = series.reduce((m, d) => (d.daily > m.daily ? d : m), { date: "-", daily: 0, cum: 0, battles: 0 });
    const peakByBattles = series.reduce((m, d) => (d.battles > m.battles ? d : m), { date: "-", daily: 0, cum: 0, battles: 0 });
    const activeDays = series.filter((d) => d.daily > 0).length;
    const first = series[0]?.date ?? "-";
    const last = series[series.length - 1]?.date ?? "-";
    return { series, total, totalBattles, peak, peakByBattles, activeDays, first, last };
  }, [days]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / platform growth</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Total SOL traded on the WaveWarZ battle contract since launch - the cumulative
          line only climbs. Per-battle volumes from the WaveWarZ public API.
        </p>
      </header>

      {error && <p style={{ color: C.danger, fontFamily: C.mono, fontSize: 13 }}>{error}</p>}

      {!data && !error ? (
        <div className="skeleton-shimmer" style={{ height: 320, borderRadius: 16 }} />
      ) : data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Tile label="TOTAL VOLUME">
              <span style={{ color: C.accent }}>{fmt(data.total, 1)} ◎</span>
            </Tile>
            <Tile label="TOTAL BATTLES">{fmt(data.totalBattles)}</Tile>
            <Tile label="PEAK DAY (VOLUME)">
              {fmt(data.peak.daily, 1)} ◎
              <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{data.peak.date}</small>
            </Tile>
            <Tile label="PEAK DAY (BATTLES)">
              {data.peakByBattles.battles} battles
              <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{data.peakByBattles.date}</small>
            </Tile>
            <Tile label="ACTIVE DAYS">{fmt(data.activeDays)}</Tile>
            <Tile label="AVG VOL / ACTIVE DAY">{fmt(data.total / Math.max(1, data.activeDays), 2)} ◎</Tile>
          </div>

          <Panel label={`CUMULATIVE VOLUME - ${fmt(data.total, 1)} ◎ SINCE ${data.first}`}>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                  <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 0)} />
                  <Tooltip
                    contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                    labelStyle={{ color: C.dim }}
                    formatter={(v: number | string) => [`${fmt(Number(v), 1)} ◎`, "cumulative"]}
                  />
                  <Area type="monotone" dataKey="cum" stroke={C.accent} strokeWidth={2} fill="url(#volFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel label="DAILY VOLUME (◎)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                  <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => fmt(v, 0)} />
                  <Tooltip
                    cursor={{ fill: "rgba(149,254,124,0.08)" }}
                    contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                    labelStyle={{ color: C.dim }}
                    formatter={(v: number | string) => [`${fmt(Number(v), 2)} ◎`, "volume"]}
                  />
                  <Bar dataKey="daily" fill={C.accent} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {dayStats && dayStats.length > 0 && (
            <Panel label="ACTIVITY BY DAY OF WEEK">
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayStats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 12, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} />
                    <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(149,254,124,0.08)" }}
                      contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                      labelStyle={{ color: C.dim }}
                      formatter={(v: number | string, name: string) => [
                        name === "battles" ? `${v} battles` : `${fmt(Number(v), 2)} ◎`,
                        name,
                      ]}
                    />
                    <Bar dataKey="battles" fill="#8ab4ff" fillOpacity={0.85} radius={[2, 2, 0, 0]} name="battles" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ ...metaLabel, fontSize: 10, marginTop: 8, lineHeight: 1.6 }}>
                battle count by day of week · Mon = main events day (highest avg vol per battle) · quick battles run weeknights.
              </p>
            </Panel>
          )}

          {monthStats && monthStats.length > 0 && (
            <Panel label="BATTLES PER MONTH (from ww-battles.json)">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthStats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                      tickLine={false}
                      axisLine={{ stroke: C.grid }}
                      minTickGap={32}
                    />
                    <YAxis
                      tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(149,254,124,0.08)" }}
                      contentStyle={{
                        background: C.bg,
                        border: `1px solid ${C.grid}`,
                        borderRadius: 10,
                        fontFamily: C.mono,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: C.dim }}
                      formatter={(v: number | string, name: string) => [
                        name === "battles" ? `${v} battles` : `${fmt(Number(v), 2)} ◎`,
                        name === "battles" ? "battles" : "volume",
                      ]}
                    />
                    <Bar dataKey="battles" fill="#8ab4ff" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ ...metaLabel, fontSize: 10, marginTop: 10, lineHeight: 1.6 }}>
                battle count per calendar month across quick, main, and community battles.
                peak: march 2026 (188 battles). source: /ww-battles.json · partial months shown as-is.
              </p>
            </Panel>
          )}

          <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
            Volume is per-battle artist1.volumeSol + artist2.volumeSol summed by day. Sourced
            from the WaveWarZ public API at https://wavewarz.info/api/public/battles, covering
            all battles since the platform's first battle on 2025-05-28. This is the authoritative
            real both-sides volume reported by the platform. Range {data.first} to {data.last}.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={metaLabel}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}
