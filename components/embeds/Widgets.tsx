"use client";

import { useEffect, useMemo, useState } from "react";
import { FLOOR_SOL } from "@/lib/config";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmbedShell, { Counter } from "./EmbedShell";
import {
  TRADER_PNL_NOTE,
  TRADER_PNL_WITHDRAWN,
  TRADER_TABLE_HEAD,
} from "@/lib/traderLeaderboard";
import { FONTS, shortWallet, type EmbedOptions } from "@/lib/embedTheme";
import { ONCHAIN_DAILY_PATH, correctDuneDays } from "@/lib/onchainDaily";
import { secondsLeft, poolShare, type WidgetBattle } from "@/lib/liveBattle";

// Every widget is a client component that fetches its own data. That is
// deliberate: an embed is loaded on a cold cache from an origin we do not
// control, so server-rendering the numbers would tie the host page's TTFB to
// our upstreams. Fetching after paint means the host always gets an instant
// frame, and a slow upstream degrades to "Loading" inside our box rather than
// stalling their page.

const SITE = "https://wwtracker.vercel.app";

type Status = "ready" | "loading" | "error";

/** Small fetch hook with the failure contract every widget shares. */
function useJson<T>(url: string): { data: T | null; status: Status } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        if (!live) return;
        setData(j as T);
        setStatus("ready");
      })
      .catch(() => {
        if (live) setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [url]);

  return { data, status };
}

/** Envelope returned by every /api/ww/* fan-out route. */
interface Envelope<T> {
  status: "live" | "stale" | "unknown";
  data: T | null;
}

const num = (n: number, dp = 0): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function axisProps(opts: EmbedOptions) {
  return {
    tick: { fill: opts.palette.mut, fontSize: 10, fontFamily: FONTS.mono },
    stroke: opts.palette.line,
    tickLine: false,
  } as const;
}

function tooltipStyle(opts: EmbedOptions) {
  return {
    contentStyle: {
      background: opts.palette.card,
      border: `1px solid ${opts.palette.line}`,
      borderRadius: 8,
      fontFamily: FONTS.mono,
      fontSize: 11,
      color: opts.palette.ice,
    },
    labelStyle: { color: opts.palette.mut },
  };
}

/**
 * The last day a snapshot-backed series actually covers.
 *
 * These files are rebuilt on a cadence, not live, so a chart drawn from one
 * ends days before today while sitting next to a counter that is live. On a
 * partner's page those two read as a contradiction rather than as two different
 * questions. Deriving the line from the data means it can never be wrong, and
 * it travels with a screenshot.
 */
function asOf(rows: { date: string }[]): string | undefined {
  const last = rows[rows.length - 1]?.date;
  return last ? `Series runs to ${last}. Live totals move ahead of it between rebuilds.` : undefined;
}

/** Thin out a long daily series so a 320px-tall chart is not drawing 460 points. */
function thin<T>(rows: T[], max = 180): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
  if (out[out.length - 1] !== rows[rows.length - 1]) out.push(rows[rows.length - 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Treasury - Dune, over the platform's dev/treasury wallet.
// ---------------------------------------------------------------------------

interface BalanceRow {
  block_date: string;
  eod_sol_balance: number;
  day_high: number;
}

/**
 * The program's first instruction. The treasury wallet existed before WaveWarZ
 * did, and 176 of its 648 daily rows predate the platform - a flat run at
 * roughly zero that ate a quarter of the x-axis to say nothing. A chart called
 * "treasury vs operating floor" is about the platform's operations, so it
 * starts when the platform did.
 */
const PROGRAM_LAUNCH = "2025-05-26";

export function TreasuryFloor({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<{ rows: BalanceRow[] }>("/api/balance");
  const rows = useMemo(
    () => thin((data?.rows ?? []).filter((r) => r.block_date >= PROGRAM_LAUNCH)),
    [data],
  );
  const p = opts.palette;

  return (
    <EmbedShell
      title="Treasury vs operating floor"
      source="On-chain treasury balance via Dune - wwtracker"
      href={`${SITE}/#floor`}
      opts={opts}
      state={rows.length ? "ready" : status}
      errorNote="Treasury feed unavailable"
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* ComposedChart, not AreaChart. AreaChart accepts only Area as a
            graphical child, so the day_high <Line> below was being dropped on
            the floor - silently, with no warning: the widget promised "with the
            intraday high" and drew one series. The missing legend entry is what
            gave it away. */}
        <ComposedChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="tf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={opts.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={opts.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.line} vertical={false} />
          <XAxis dataKey="block_date" {...axisProps(opts)} minTickGap={40} />
          <YAxis {...axisProps(opts)} width={46} domain={[0, "auto"]} />
          {/* Two series, and which is which is the whole reading of the chart. */}
          <Legend
            verticalAlign="top"
            height={22}
            iconType="plainline"
            formatter={(value: string) => (
              <span style={{ color: p.mut, fontFamily: FONTS.mono, fontSize: 10 }}>
                {value}
              </span>
            )}
          />
          <Tooltip
            {...tooltipStyle(opts)}
            formatter={(v: number | string, name: string) => [
              `${num(Number(v), 3)} SOL`,
              name === "eod_sol_balance" ? "close" : "intraday high",
            ]}
          />
          {/* The floor is the whole point of this chart, so it is drawn on top
              of the series rather than behind it. */}
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="eod_sol_balance"
            name="close"
            stroke={opts.accent}
            strokeWidth={2}
            fill="url(#tf)"
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="day_high"
            name="intraday high"
            stroke={p.blue}
            strokeWidth={1}
            dot={false}
          />
          <ReferenceLine
            y={FLOOR_SOL}
            stroke={p.red}
            strokeDasharray="4 4"
            label={{
              // insideTopRight put this directly on the series - the balance
              // has been sitting just above the floor since April. The left
              // edge is the one part of the plot the data has left alone.
              value: `${FLOOR_SOL} FLOOR`,
              position: "insideTopLeft",
              fill: p.mut,
              fontSize: 9,
              fontFamily: FONTS.mono,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

export function TreasuryBalance({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<{ rows: BalanceRow[] }>("/api/balance");
  const rows = data?.rows ?? [];
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const delta = last && prev ? last.eod_sol_balance - prev.eod_sol_balance : null;

  return (
    <EmbedShell
      title="Treasury balance"
      source="On-chain treasury balance via Dune - wwtracker"
      href={`${SITE}/#floor`}
      opts={opts}
      state={last ? "ready" : status}
      errorNote="Treasury feed unavailable"
    >
      <Counter
        opts={opts}
        value={last ? `${num(last.eod_sol_balance, 2)} SOL` : "-"}
        sub={
          delta === null
            ? undefined
            : `${delta >= 0 ? "+" : ""}${num(delta, 3)} SOL since previous close - floor ${FLOOR_SOL}`
        }
      />
    </EmbedShell>
  );
}

// ---------------------------------------------------------------------------
// Volume - rebuilt from the platform's own per-battle volumes.
// ---------------------------------------------------------------------------

interface VolDay {
  date: string;
  vol: number;
  battles: number;
}

function useVolume() {
  const { data, status } = useJson<VolDay[]>("/ww-platform-volume.json");
  return { rows: data ?? [], status };
}

const VOLUME_SOURCE =
  "Per-battle volume from wavewarz.info public API - wwtracker";

export function VolumeCumulative({ opts }: { opts: EmbedOptions }) {
  const { rows, status } = useVolume();
  const series = useMemo(() => {
    let cum = 0;
    return thin(
      rows.map((d) => {
        cum += d.vol;
        return { date: d.date, cum: Math.round(cum * 1000) / 1000 };
      }),
    );
  }, [rows]);

  return (
    <EmbedShell
      title="Cumulative volume since launch"
      source={VOLUME_SOURCE}
      href={`${SITE}/#growth`}
      opts={opts}
      state={series.length ? "ready" : status}
      note={asOf(rows)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="vc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={opts.accent} stopOpacity={0.38} />
              <stop offset="100%" stopColor={opts.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={opts.palette.line} vertical={false} />
          <XAxis dataKey="date" {...axisProps(opts)} minTickGap={44} />
          <YAxis {...axisProps(opts)} width={48} />
          <Tooltip
            {...tooltipStyle(opts)}
            formatter={(v: number | string) => [`${num(Number(v), 1)} SOL`, "cumulative"]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="cum"
            stroke={opts.accent}
            strokeWidth={2}
            fill="url(#vc)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

function DailyBars({
  opts,
  title,
  dataKey,
  unit,
  href,
}: {
  opts: EmbedOptions;
  title: string;
  dataKey: "vol" | "battles";
  unit: string;
  href: string;
}) {
  const { rows, status } = useVolume();
  // Leading empty days are noise on a bar chart - start at first real activity.
  const series = useMemo(() => {
    const first = rows.findIndex((r) => r[dataKey] > 0);
    return thin(first < 0 ? [] : rows.slice(first), 220);
  }, [rows, dataKey]);

  return (
    <EmbedShell
      title={title}
      source={VOLUME_SOURCE}
      href={href}
      opts={opts}
      state={series.length ? "ready" : status}
      note={asOf(rows)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 4, right: 6, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={opts.palette.line} vertical={false} />
          <XAxis dataKey="date" {...axisProps(opts)} minTickGap={44} />
          <YAxis {...axisProps(opts)} width={46} />
          <Tooltip
            {...tooltipStyle(opts)}
            cursor={{ fill: opts.palette.blueDim }}
            formatter={(v: number | string) => [
              `${num(Number(v), dataKey === "vol" ? 2 : 0)} ${unit}`,
              dataKey === "vol" ? "volume" : "battles",
            ]}
          />
          <Bar isAnimationActive={false} dataKey={dataKey} fill={opts.accent} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

export function VolumeDaily({ opts }: { opts: EmbedOptions }) {
  return (
    <DailyBars
      opts={opts}
      title="Daily trading volume"
      dataKey="vol"
      unit="SOL"
      href={`${SITE}/#growth`}
    />
  );
}

export function BattlesDaily({ opts }: { opts: EmbedOptions }) {
  return (
    <DailyBars
      opts={opts}
      title="Battles per day"
      dataKey="battles"
      unit="battles"
      href={`${SITE}/#battles`}
    />
  );
}

// ---------------------------------------------------------------------------
// Activity - decoded program instructions. Nothing else on any WaveWarZ surface
// shows this, which is precisely why it is worth embedding.
// ---------------------------------------------------------------------------

interface OnchainDay {
  date: string;
  txs: number;
  traders: number;
  buys: number;
  sells: number;
  claims: number;
  created: number;
  settled: number;
  minted: number;
}

const ONCHAIN_SOURCE = "Daily program activity via Dune - wwtracker";
const CHAIN_SCAN_SOURCE = "Complete chain scan of the WaveWarZ program - wwtracker";

export function ProgramActivity({ opts }: { opts: EmbedOptions }) {
  // Through the corrected path even though this chart only plots txs and
  // unique signers, neither of which is transposed. A widget that reads the raw
  // file is one edit away from plotting a swapped column, and this file already
  // produced that bug twice.
  const { data, status } = useJson<OnchainDay[]>(ONCHAIN_DAILY_PATH);
  const corrected = useMemo(() => (data ? correctDuneDays(data) : null), [data]);
  const series = useMemo(() => thin(corrected ?? []), [corrected]);

  return (
    <EmbedShell
      title="On-chain program activity"
      source={ONCHAIN_SOURCE}
      href={`${SITE}/#analytics`}
      opts={opts}
      state={series.length ? "ready" : status}
      note={asOf(corrected ?? [])}
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* left:-18 with a 40px axis clipped the hundreds ticks to ":00" and
            ".50" - the axis was cropping its own labels, which reads as a
            broken chart rather than a tight one. Give it the room. */}
        <LineChart data={series} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid stroke={opts.palette.line} vertical={false} />
          <XAxis dataKey="date" {...axisProps(opts)} minTickGap={44} />
          <YAxis {...axisProps(opts)} width={46} />
          <Tooltip {...tooltipStyle(opts)} />
          {/* Two series and no key is a puzzle, not a chart. */}
          <Legend
            verticalAlign="top"
            height={22}
            iconType="plainline"
            formatter={(value: string) => (
              <span style={{ color: opts.palette.mut, fontFamily: FONTS.mono, fontSize: 10 }}>
                {value}
              </span>
            )}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="txs"
            name="transactions"
            stroke={opts.accent}
            strokeWidth={2}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="traders"
            name="unique signers"
            stroke={opts.palette.blue}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

interface InstructionMixFile {
  measuredThrough: string;
  calls: Record<string, number>;
}

// This widget does NOT read the Dune daily series, and that is deliberate.
//
// tools/dune-daydiff.py in wavewarz-protocol shows Dune has `sells` and
// `claims` TRANSPOSED on 259 of 330 days. Aggregating that file published
// sellShares 3409 / claimShares 2762 when the program says 2671 / 3390 - the
// two bars swapped, on a partner's page, in the one widget whose whole claim is
// that it is decoded straight off the chain.
//
// A pair transposition conserves the total, so no aggregate check could see it.
// The fix is not a smarter check; it is to read the complete chain scan, which
// is what public/ww-instruction-mix.json is.
export function InstructionMix({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<InstructionMixFile>("/ww-instruction-mix.json");
  const bars = useMemo(
    () =>
      data ? Object.entries(data.calls).map(([name, calls]) => ({ name, calls })) : [],
    [data],
  );

  return (
    <EmbedShell
      title="Instruction mix"
      source={CHAIN_SCAN_SOURCE}
      href={`${SITE}/#analytics`}
      opts={opts}
      state={bars.length ? "ready" : status}
      // A count with no "as of" is a count somebody will still be quoting in
      // March. endBattle is absent on purpose: the census gives 1,506 battles
      // with a distribution and 1,550 with a winner decided, and neither is
      // provably the number of end_battle CALLS.
      note={
        data
          ? `Every call decoded off the program through ${data.measuredThrough}. endBattle omitted - not separable from settlement records.`
          : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          layout="vertical"
          margin={{ top: 4, right: 46, left: 22, bottom: 0 }}
        >
          <CartesianGrid stroke={opts.palette.line} horizontal={false} />
          <XAxis type="number" {...axisProps(opts)} />
          <YAxis type="category" dataKey="name" {...axisProps(opts)} width={78} />
          <Tooltip
            {...tooltipStyle(opts)}
            cursor={{ fill: opts.palette.blueDim }}
            formatter={(v: number | string) => [num(Number(v)), "calls"]}
          />
          {/* Screenshotted more than hovered, so the value is on the bar. */}
          <Bar isAnimationActive={false} dataKey="calls" fill={opts.accent} radius={[0, 3, 3, 0]}>
            <LabelList
              dataKey="calls"
              position="right"
              formatter={(v: number | string) => num(Number(v))}
              style={{
                fill: opts.palette.mut,
                fontFamily: FONTS.mono,
                fontSize: 10,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

// ---------------------------------------------------------------------------
// Platform counters - mirrors of the host site's own headline numbers, read
// through our cached fan-out so they can never disagree with it.
// ---------------------------------------------------------------------------

interface PublicStats {
  solPriceUsd: number;
  volume: { totalSol: number; totalUsd: number; last24hSol: number; last7dSol: number };
  artistPayouts: { totalSol: number; totalUsd: number };
  traderClaims: { totalSol: number; totalUsd: number; withdrawalCount: number };
  battles: {
    total: number;
    mainEvents: number;
    mainBattles: number;
    quickBattles: number;
    communityBattles: number;
  };
}

const PLATFORM_SOURCE = "wavewarz.info public API - wwtracker";

function useStats() {
  const { data, status } = useJson<Envelope<PublicStats>>("/api/ww/stats");
  // status "unknown" upstream means we genuinely have no figure. Rendering a
  // zero there would be a lie, so it is treated as an error state.
  const s = data?.data ?? null;
  return { stats: s, status: s ? ("ready" as Status) : status === "loading" ? "loading" : "error" };
}

function StatCounter({
  opts,
  title,
  value,
  sub,
  href,
}: {
  opts: EmbedOptions;
  title: string;
  value: string | null;
  sub?: string;
  href: string;
}) {
  return (
    <EmbedShell
      title={title}
      source={PLATFORM_SOURCE}
      href={href}
      opts={opts}
      state={value ? "ready" : "loading"}
    >
      <Counter opts={opts} value={value ?? "-"} sub={sub} />
    </EmbedShell>
  );
}

export function TotalVolume({ opts }: { opts: EmbedOptions }) {
  const { stats } = useStats();
  return (
    <StatCounter
      opts={opts}
      title="Total volume"
      href={`${SITE}/#growth`}
      value={stats ? `${num(stats.volume.totalSol, 2)} SOL` : null}
      sub={
        stats
          ? `$${num(stats.volume.totalUsd)} - ${num(stats.volume.last7dSol, 2)} SOL last 7d`
          : undefined
      }
    />
  );
}

export function TotalBattles({ opts }: { opts: EmbedOptions }) {
  const { stats } = useStats();
  return (
    <StatCounter
      opts={opts}
      title="Total battles"
      href={`${SITE}/#battles`}
      value={stats ? num(stats.battles.total) : null}
      sub={
        stats
          ? `${num(stats.battles.mainEvents)} main events - ${num(stats.battles.quickBattles)} quick - ${num(stats.battles.communityBattles)} community`
          : undefined
      }
    />
  );
}

export function ArtistPayouts({ opts }: { opts: EmbedOptions }) {
  const { stats } = useStats();
  return (
    <StatCounter
      opts={opts}
      title="Paid to artists"
      href={`${SITE}/#profitability`}
      value={stats ? `${num(stats.artistPayouts.totalSol, 2)} SOL` : null}
      sub={stats ? `$${num(stats.artistPayouts.totalUsd)} - automatic, on-chain` : undefined}
    />
  );
}

export function TraderClaims({ opts }: { opts: EmbedOptions }) {
  const { stats } = useStats();
  return (
    <StatCounter
      opts={opts}
      title="Claimed by traders"
      href={`${SITE}/#traders`}
      value={stats ? `${num(stats.traderClaims.totalSol, 2)} SOL` : null}
      sub={
        stats
          ? `$${num(stats.traderClaims.totalUsd)} across ${num(stats.traderClaims.withdrawalCount)} withdrawals`
          : undefined
      }
    />
  );
}

export function BattleTypeMix({ opts }: { opts: EmbedOptions }) {
  const { stats, status } = useStats();
  const p = opts.palette;
  const slices = stats
    ? [
        { name: "Quick", value: stats.battles.quickBattles, fill: opts.accent },
        { name: "Main", value: stats.battles.mainBattles, fill: p.blue },
        { name: "Community", value: stats.battles.communityBattles, fill: p.mut },
      ]
    : [];

  return (
    <EmbedShell
      title="Battle type mix"
      source={PLATFORM_SOURCE}
      href={`${SITE}/#battles`}
      opts={opts}
      state={slices.length ? "ready" : status}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            isAnimationActive={false}
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.fill} />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle(opts)}
            formatter={(v: number | string, n: string) => [num(Number(v)), n]}
          />
          {/* A donut with no key is decoration, not information. The counts go
              in the legend so the widget is readable without hovering - which
              matters because a lot of these get screenshotted. */}
          <Legend
            verticalAlign="bottom"
            height={26}
            formatter={(value: string) => {
              const hit = slices.find((s) => s.name === value);
              return (
                <span
                  style={{
                    color: opts.palette.mut,
                    fontFamily: FONTS.mono,
                    fontSize: 10.5,
                  }}
                >
                  {value} {hit ? num(hit.value) : ""}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </EmbedShell>
  );
}

// ---------------------------------------------------------------------------
// Leaderboards - live off the public API.
// ---------------------------------------------------------------------------

/**
 * A remote image that cannot break the widget.
 *
 * Artist avatars and cover art come from Audius content nodes and unavatar,
 * and those go down: a 22-URL sample on 2026-09-09 had one 502 and one artist
 * with no picture at all. A bare <img> in that state renders the browser's
 * broken-image glyph on a partner's page, which looks like our bug. So a
 * failure collapses to a plain initial tile instead, and the row still reads.
 */
function Avatar({
  src,
  seed,
  opts,
  size = 18,
}: { src: string | null; seed: string; opts: EmbedOptions; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size,
    height: size,
    borderRadius: 4,
    flexShrink: 0,
    objectFit: "cover" as const,
  };

  if (!src || failed) {
    return (
      <span
        style={{
          ...box,
          display: "inline-grid",
          placeItems: "center",
          background: opts.palette.card,
          color: opts.palette.mut,
          fontFamily: FONTS.mono,
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
        }}
      >
        {seed.trim().slice(0, 1).toUpperCase() || "-"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" style={box} onError={() => setFailed(true)} />
  );
}

function Table({
  opts,
  head,
  rows,
  icons,
  /**
   * Column 1 was capped at 150px for wallet addresses, which are 12 characters.
   * Song titles are not: "Limit Breaker Ft Cannon Jones - K..." was being cut
   * while a third of the row sat empty. The cap belongs to the content.
   */
  nameMaxWidth = 150,
}: {
  opts: EmbedOptions;
  head: string[];
  rows: (string | number)[][];
  icons?: (string | null)[];
  nameMaxWidth?: number;
}) {
  const p = opts.palette;
  return (
    <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: FONTS.mono,
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i === 0 || i === 1 ? "left" : "right",
                  padding: "5px 6px",
                  color: p.mut,
                  fontWeight: 500,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  fontSize: 9.5,
                  borderBottom: `1px solid ${p.line}`,
                  position: "sticky",
                  top: 0,
                  background: opts.transparent ? p.bg : p.bg,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: ci === 0 || ci === 1 ? "left" : "right",
                    padding: "5px 6px",
                    borderBottom: `1px solid ${p.line}`,
                    color: ci === 0 ? p.mut : p.ice,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: ci === 1 ? nameMaxWidth : undefined,
                  }}
                >
                  {ci === 1 && icons ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <Avatar src={icons[ri] ?? null} seed={String(c)} opts={opts} />
                      <span
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c}
                      </span>
                    </span>
                  ) : (
                    c
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ArtistRow {
  name: string;
  wins: number;
  losses: number;
  draws: number;
  battles: number;
  totalVolumeSol: string;
  totalEarningsSol: string;
  pfpUrl?: string | null;
}
interface TraderRow {
  wallet: string;
  totalVolumeSol: number;
  tradeCount: number;
  battleCount: number;
  winRate: number;
  netPnlSol: number;
}
interface SongRow {
  songTitle: string;
  artistName: string;
  battles: number;
  winRate: number;
  totalVolumeSol: number;
  artUrl?: string | null;
}

export function TopArtists({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<Envelope<{ artists: ArtistRow[] }>>(
    "/api/ww/leaderboards/artists?limit=25",
  );
  const rows = data?.data?.artists ?? [];
  return (
    <EmbedShell
      title="Top artists"
      source={PLATFORM_SOURCE}
      href={`${SITE}/#traders`}
      opts={opts}
      state={rows.length ? "ready" : status}
      // This board is ordered by RECORD, not by volume, and it was described as
      // "ranked by volume" until 2026-09-09 - which made the volume column look
      // broken: AI LUI sits eleventh on 100.39 SOL, above everyone from rank 2
      // down. The order is the host site's own, and a platform widget that
      // re-sorts stops agreeing with the board it mirrors. So the label moves,
      // not the rows.
      note="Ordered by record, as the platform ranks it - not by the volume column."
    >
      <Table
        opts={opts}
        head={["#", "Artist", "Rec", "Battles", "Volume", "Earned"]}
        icons={rows.map((a) => a.pfpUrl ?? null)}
        rows={rows.map((a, i) => [
          i + 1,
          a.name,
          a.draws ? `${a.wins}-${a.losses}-${a.draws}` : `${a.wins}-${a.losses}`,
          a.battles,
          num(Number(a.totalVolumeSol), 2),
          num(Number(a.totalEarningsSol), 3),
        ])}
      />
    </EmbedShell>
  );
}

export function TopTraders({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<Envelope<{ traders: TraderRow[] }>>(
    "/api/ww/leaderboards/traders?limit=25",
  );
  const rows = data?.data?.traders ?? [];
  return (
    <EmbedShell
      title="Top traders"
      source={PLATFORM_SOURCE}
      href={`${SITE}/#traders`}
      opts={opts}
      state={rows.length ? "ready" : status}
      // Net P&L was withdrawn 2026-09-07 and restored 2026-09-08 after the
      // record layer backfilled and we re-measured: 0 of 157 wallets now read
      // profitable while down, against 45 of 145 before. The note stays either
      // way - it carries the date and the residual, so a screenshot of this
      // widget says when it was checked. lib/traderLeaderboard.ts has the
      // working.
      note={TRADER_PNL_NOTE}
    >
      <Table
        opts={opts}
        // The API returns raw floats here (winRate comes back as 79.3103448...),
        // so every numeric column is rounded before display.
        head={[...TRADER_TABLE_HEAD]}
        rows={rows.map((t, i) => [
          i + 1,
          shortWallet(t.wallet),
          num(t.totalVolumeSol, 2),
          num(t.winRate, 0),
          `${t.netPnlSol >= 0 ? "+" : ""}${num(t.netPnlSol, 2)}`,
        ])}
      />
    </EmbedShell>
  );
}

export function TopSongs({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<Envelope<{ songs: SongRow[] }>>(
    "/api/ww/leaderboards/songs?limit=25",
  );
  const rows = data?.data?.songs ?? [];
  return (
    <EmbedShell
      title="Top songs"
      source={PLATFORM_SOURCE}
      href={`${SITE}/#music`}
      opts={opts}
      state={rows.length ? "ready" : status}
    >
      <Table
        opts={opts}
        head={["#", "Song", "Battles", "Win %", "Volume"]}
        icons={rows.map((s) => s.artUrl ?? null)}
        nameMaxWidth={260}
        rows={rows.map((s, i) => [
          i + 1,
          // Some songTitle values carry trailing whitespace from admin entry.
          `${s.songTitle.trim()} - ${s.artistName}`,
          s.battles,
          num(s.winRate, 0),
          num(s.totalVolumeSol, 2),
        ])}
      />
    </EmbedShell>
  );
}

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Live battle. The only widget that changes while you are looking at it, and
// the first one built for an arena rather than for an analytics page.
//
// It polls, counts down, and hands off to wavewarz.com to actually trade. It
// does NOT execute a trade, and that is a product decision now rather than a
// technical block: the IDL was recovered and verified 40/40 against mainnet on
// 2026-09-08 (chain/wavewarz.idl.json in wavewarz-protocol). Signing somebody's
// transaction from inside an iframe on a third-party page is a different thing
// to ask for than a chart. The button says "trade on wavewarz.com" rather than
// "trade", because a button that looks like it trades and then navigates away
// is worse than an honest link.
//
// Designed for the state it is in most of the time - nothing live. Quick
// battles run about ten minutes on weeknights, so a widget that only looks
// right mid-battle would look broken all day. The finished-battle state is the
// default, not the fallback.
// ---------------------------------------------------------------------------

function BattleSide({
  track, artist, pool, art, share, won, opts, dim,
}: {
  track: string; artist: string; pool: number; art: string | null; share: number;
  won: boolean; opts: EmbedOptions; dim: boolean;
}) {
  const p = opts.palette;
  return (
    <div style={{ flex: 1, minWidth: 0, opacity: dim ? 0.55 : 1 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        {/* Audius content nodes 502 often enough to matter; a bare img renders
            the browser's broken-image glyph on a partner's page. */}
        <Avatar src={art} seed={artist} opts={opts} size={34} />
        <div style={{ minWidth: 0 }}>
          {/* The artist competes; the track is what they entered. The API
              conflates these - `name` is the track - so both are shown, with
              the artist first because that is who has a record. */}
          <div style={{
            color: p.ice, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{artist}</div>
          <div style={{
            color: p.mut, fontSize: 11, lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{track}</div>
          {/* The winner used to replace its own pool figure with the word
              WINNER, so exactly one side showed a number and the two could not
              be compared - in a widget whose point is the split. Show both. */}
          <div style={{ color: won ? p.green : p.mut, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 2 }}>
            {num(pool, 3)} SOL{won ? " - WINNER" : ""}
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: p.line, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${Math.round(share * 100)}%`, height: "100%",
          background: won ? p.green : p.mut, transition: "width .4s",
        }} />
      </div>
    </div>
  );
}

export function LiveBattle({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<{ status: string; data: WidgetBattle | null }>("/api/ww/battle");
  const battle = data?.data ?? null;
  const [now, setNow] = useState(() => Date.now());

  // Only tick while a battle is actually running. A timer on a finished battle
  // is a re-render every second for a number that never changes.
  useEffect(() => {
    if (!battle?.live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [battle?.live]);

  const left = battle ? secondsLeft(battle.endsAt, now) : null;
  const share = battle ? poolShare(battle.a.poolSol, battle.b.poolSol) : 0.5;
  const p = opts.palette;

  return (
    <EmbedShell
      opts={opts}
      title="Battle"
      source="wavewarz.info"
      href="https://wwtracker.vercel.app/#surfaces"
      state={status}
    >
      {!battle ? (
        <p style={{ color: p.mut, fontSize: 13 }}>No battles found.</p>
      ) : (
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: ".08em",
          }}>
            {battle.live ? (
              <>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", background: p.green,
                  display: "inline-block",
                }} />
                <span style={{ color: p.green }}>LIVE</span>
                {left !== null && (
                  <span style={{ color: p.mut }}>
                    {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} LEFT
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: p.mut }}>
                {battle.settled ? "LAST BATTLE" : "AWAITING RESULT"}
              </span>
            )}
            <span style={{ color: p.mut, marginLeft: "auto" }}>
              {battle.type.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <BattleSide
              track={battle.a.track} artist={battle.a.artist}
              pool={battle.a.poolSol} art={battle.a.art}
              share={share} opts={opts}
              won={battle.winnerSide === "artist1"}
              dim={battle.settled && battle.winnerSide === "artist2"}
            />
            <div style={{ color: p.mut, fontFamily: FONTS.mono, fontSize: 11, paddingTop: 10 }}>
              VS
            </div>
            <BattleSide
              track={battle.b.track} artist={battle.b.artist}
              pool={battle.b.poolSol} art={battle.b.art}
              share={1 - share} opts={opts}
              won={battle.winnerSide === "artist2"}
              dim={battle.settled && battle.winnerSide === "artist1"}
            />
          </div>

          {battle.poll && (battle.poll.a > 0 || battle.poll.b > 0) && (
            <div style={{ color: p.mut, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 10 }}>
              POLL {battle.poll.a} - {battle.poll.b}
              {battle.djWavy && ` / DJ WAVY: ${battle.djWavy === "artist1" ? "A" : "B"}`}
            </div>
          )}

          {/* The finished state left roughly half a 300px box empty, which
              reads as a widget that failed to load the rest. These are facts
              we already hold and were throwing away. */}
          <div style={{ color: p.mut, fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 8 }}>
            POOL {num(battle.a.poolSol + battle.b.poolSol, 3)} SOL
            {battle.endsAt && ` / ${battle.live ? "ENDS" : "ENDED"} ${battle.endsAt.slice(0, 10)}`}
            {` / #${battle.id}`}
          </div>

          <a
            href={battle.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", marginTop: 12, padding: "8px 10px", textAlign: "center",
              border: `1px solid ${battle.live ? p.green : p.line}`, borderRadius: 6,
              color: battle.live ? p.green : p.mut,
              fontFamily: FONTS.mono, fontSize: 11, letterSpacing: ".06em",
              textDecoration: "none",
            }}
          >
            {battle.live ? "TRADE ON WAVEWARZ.COM" : "SEE THE BATTLE"}
          </a>
        </div>
      )}
    </EmbedShell>
  );
}

export const WIDGETS: Record<string, (p: { opts: EmbedOptions }) => JSX.Element> = {
  "live-battle": LiveBattle,
  "treasury-floor": TreasuryFloor,
  "treasury-balance": TreasuryBalance,
  "volume-cumulative": VolumeCumulative,
  "volume-daily": VolumeDaily,
  "battles-daily": BattlesDaily,
  "program-activity": ProgramActivity,
  "instruction-mix": InstructionMix,
  "total-volume": TotalVolume,
  "total-battles": TotalBattles,
  "artist-payouts": ArtistPayouts,
  "trader-claims": TraderClaims,
  "battle-type-mix": BattleTypeMix,
  "top-artists": TopArtists,
  "top-traders": TopTraders,
  "top-songs": TopSongs,
};
