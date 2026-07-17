"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number; type: string };
const battles = battlesRaw as Battle[];

const SNAPSHOT_DATE = "2026-07-17";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export default function PlatformPulse() {
  const stats = useMemo(() => {
    const now = new Date(SNAPSHOT_DATE);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60);

    const last7 = battles.filter((b) => new Date(b.date) >= d7);
    const last30 = battles.filter((b) => new Date(b.date) >= d30);
    const prior30 = battles.filter((b) => new Date(b.date) >= d60 && new Date(b.date) < d30);

    const totalVol = battles.reduce((s, b) => s + (b.vol ?? 0), 0);
    const avgVolAll = totalVol / battles.length;

    const vol30 = last30.reduce((s, b) => s + (b.vol ?? 0), 0);
    const volPrior30 = prior30.reduce((s, b) => s + (b.vol ?? 0), 0);
    const avgVolLast30 = last30.length > 0 ? vol30 / last30.length : 0;

    // Active days
    const activeDaySet = new Set(battles.map((b) => b.date));
    const allDates = [...battles].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = new Date(allDates[0]?.date ?? SNAPSHOT_DATE);
    const totalSpan = daysBetween(firstDate, now);
    const activeDays = activeDaySet.size;

    // All-time pace
    const allTimePerDay = battles.length / totalSpan;
    const last7PerDay = last7.length / 7;

    // Change percentages
    const volChangePct = volPrior30 > 0 ? ((vol30 - volPrior30) / volPrior30) * 100 : 0;
    const countChangePct = prior30.length > 0 ? ((last30.length - prior30.length) / prior30.length) * 100 : 0;
    const avgVolChangePct = avgVolAll > 0 ? ((avgVolLast30 - avgVolAll) / avgVolAll) * 100 : 0;

    return {
      last7Count: last7.length,
      last7Vol: last7.reduce((s, b) => s + (b.vol ?? 0), 0),
      last7PerDay,
      allTimePerDay,
      last30Count: last30.length,
      vol30,
      volPrior30,
      volChangePct,
      countChangePct,
      avgVolLast30,
      avgVolAll,
      avgVolChangePct,
      activeDays,
      totalSpan,
      uptimePct: (activeDays / totalSpan) * 100,
    };
  }, []);

  const paceLabel = stats.last7PerDay >= stats.allTimePerDay ? "above avg pace" : "below avg pace";
  const paceUp = stats.last7PerDay >= stats.allTimePerDay;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>PLATFORM PULSE</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          recent vs historical velocity · data through {SNAPSHOT_DATE}
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {/* Last 7d pace */}
        <PulseTile
          label="LAST 7D PACE"
          value={`${stats.last7Count} battles`}
          sub={`${stats.last7PerDay.toFixed(1)}/day vs ${stats.allTimePerDay.toFixed(1)} avg`}
          tag={paceLabel}
          tagUp={paceUp}
        />

        {/* 30d count trend */}
        <PulseTile
          label="30D BATTLE COUNT"
          value={`${stats.last30Count} battles`}
          sub={`vs ${stats.last30Count - Math.round((stats.countChangePct / 100) * stats.last30Count)} prior 30d`}
          tag={`${stats.countChangePct >= 0 ? "+" : ""}${stats.countChangePct.toFixed(0)}% battles`}
          tagUp={stats.countChangePct >= 0}
        />

        {/* 30d volume trend */}
        <PulseTile
          label="30D VOLUME"
          value={`${stats.vol30.toFixed(2)} ◎`}
          sub={`vs ${stats.volPrior30.toFixed(2)} ◎ prior 30d`}
          tag={`${stats.volChangePct >= 0 ? "+" : ""}${stats.volChangePct.toFixed(0)}% vol`}
          tagUp={stats.volChangePct >= 0}
        />

        {/* Avg vol/battle */}
        <PulseTile
          label="AVG STAKES"
          value={`${stats.avgVolLast30.toFixed(3)} ◎`}
          sub={`per battle (last 30d) · ${stats.avgVolAll.toFixed(3)} ◎ all-time`}
          tag={`${stats.avgVolChangePct >= 0 ? "+" : ""}${stats.avgVolChangePct.toFixed(0)}% vs avg`}
          tagUp={stats.avgVolChangePct >= 0}
        />

        {/* Platform uptime */}
        <PulseTile
          label="PLATFORM UPTIME"
          value={`${stats.activeDays} active days`}
          sub={`of ${stats.totalSpan} total · ${stats.uptimePct.toFixed(0)}% uptime`}
          tag={`${stats.uptimePct.toFixed(0)}% of days`}
          tagUp={stats.uptimePct >= 50}
        />
      </div>

      <div
        style={{
          background: `${C.grid}18`,
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: C.mono,
          fontSize: 12,
          color: C.dim,
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: C.text, fontWeight: 600 }}>Signal: </span>
        Battle frequency is{" "}
        <span style={{ color: C.accent }}>up {Math.abs(stats.countChangePct).toFixed(0)}%</span> vs prior 30d
        but average vol/battle is{" "}
        <span style={{ color: C.dim }}>
          {Math.abs(stats.avgVolChangePct).toFixed(0)}% below all-time average
        </span>{" "}
        — more battles at lower individual stakes. Platform is active but bet sizes have compressed.
      </div>
    </div>
  );
}

function PulseTile({
  label,
  value,
  sub,
  tag,
  tagUp,
}: {
  label: string;
  value: string;
  sub: string;
  tag: string;
  tagUp: boolean;
}) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.grid}`,
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 160,
        flex: "1 1 160px",
      }}
    >
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 10,
          color: C.dim,
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 16, color: C.text, fontWeight: 700 }}>{value}</div>
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      <div
        style={{
          display: "inline-block",
          marginTop: 6,
          fontFamily: C.mono,
          fontSize: 10,
          fontWeight: 600,
          color: tagUp ? C.accent : C.dim,
          background: tagUp ? `${C.accent}15` : `${C.grid}30`,
          border: `1px solid ${tagUp ? C.accent + "44" : C.grid}`,
          borderRadius: 4,
          padding: "2px 6px",
        }}
      >
        {tag}
      </div>
    </div>
  );
}
