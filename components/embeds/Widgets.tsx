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
import { FONTS, shortWallet, type EmbedOptions } from "@/lib/embedTheme";
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

export function TreasuryFloor({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<{ rows: BalanceRow[] }>("/api/balance");
  const rows = useMemo(() => thin(data?.rows ?? []), [data]);
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
        <AreaChart data={rows} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="tf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={opts.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={opts.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.line} vertical={false} />
          <XAxis dataKey="block_date" {...axisProps(opts)} minTickGap={40} />
          <YAxis {...axisProps(opts)} width={44} domain={[0, "auto"]} />
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
            stroke={opts.accent}
            strokeWidth={2}
            fill="url(#tf)"
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="day_high"
            stroke={p.blue}
            strokeWidth={1}
            dot={false}
          />
          <ReferenceLine
            y={FLOOR_SOL}
            stroke={p.red}
            strokeDasharray="4 4"
            label={{
              value: `${FLOOR_SOL} FLOOR`,
              position: "insideTopRight",
              fill: p.mut,
              fontSize: 9,
              fontFamily: FONTS.mono,
            }}
          />
        </AreaChart>
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

const ONCHAIN_SOURCE = "Decoded program instructions via Dune - wwtracker";

export function ProgramActivity({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<OnchainDay[]>("/ww-onchain-daily.json");
  const series = useMemo(() => thin(data ?? []), [data]);

  return (
    <EmbedShell
      title="On-chain program activity"
      source={ONCHAIN_SOURCE}
      href={`${SITE}/#analytics`}
      opts={opts}
      state={series.length ? "ready" : status}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={opts.palette.line} vertical={false} />
          <XAxis dataKey="date" {...axisProps(opts)} minTickGap={44} />
          <YAxis {...axisProps(opts)} width={40} />
          <Tooltip {...tooltipStyle(opts)} />
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

export function InstructionMix({ opts }: { opts: EmbedOptions }) {
  const { data, status } = useJson<OnchainDay[]>("/ww-onchain-daily.json");
  const bars = useMemo(() => {
    if (!data?.length) return [];
    const t = data.reduce(
      (a, d) => ({
        buys: a.buys + d.buys,
        sells: a.sells + d.sells,
        claims: a.claims + d.claims,
        created: a.created + d.created,
        settled: a.settled + d.settled,
      }),
      { buys: 0, sells: 0, claims: 0, created: 0, settled: 0 },
    );
    return [
      { name: "buyShares", calls: t.buys },
      { name: "sellShares", calls: t.sells },
      { name: "claimShares", calls: t.claims },
      { name: "createBattle", calls: t.created },
      { name: "endBattle", calls: t.settled },
    ];
  }, [data]);

  return (
    <EmbedShell
      title="Instruction mix"
      source={ONCHAIN_SOURCE}
      href={`${SITE}/#analytics`}
      opts={opts}
      state={bars.length ? "ready" : status}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 22, bottom: 0 }}
        >
          <CartesianGrid stroke={opts.palette.line} horizontal={false} />
          <XAxis type="number" {...axisProps(opts)} />
          <YAxis type="category" dataKey="name" {...axisProps(opts)} width={78} />
          <Tooltip
            {...tooltipStyle(opts)}
            cursor={{ fill: opts.palette.blueDim }}
            formatter={(v: number | string) => [num(Number(v)), "calls"]}
          />
          <Bar isAnimationActive={false} dataKey="calls" fill={opts.accent} radius={[0, 3, 3, 0]} />
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

function Table({
  opts,
  head,
  rows,
}: {
  opts: EmbedOptions;
  head: string[];
  rows: (string | number)[][];
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
                    maxWidth: ci === 1 ? 150 : undefined,
                  }}
                >
                  {c}
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
  totalVolumeSol: string;
  totalEarningsSol: string;
}
interface TraderRow {
  wallet: string;
  totalVolumeSol: number;
  tradeCount: number;
  winRate: number;
  netPnlSol: number;
}
interface SongRow {
  songTitle: string;
  artistName: string;
  battles: number;
  winRate: number;
  totalVolumeSol: number;
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
    >
      <Table
        opts={opts}
        head={["#", "Artist", "Rec", "Volume", "Earned"]}
        rows={rows.map((a, i) => [
          i + 1,
          a.name,
          `${a.wins}-${a.losses}`,
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
    >
      <Table
        opts={opts}
        // The API returns raw floats here (winRate comes back as 79.3103448...),
        // so every numeric column is rounded before display.
        head={["#", "Wallet", "Volume", "Win %", "Net P&L"]}
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
// does NOT execute a trade: that needs the program IDL, which is private. The
// button says "trade on wavewarz.com" rather than "trade", because a button
// that looks like it trades and then navigates away is worse than an honest
// link.
//
// Designed for the state it is in most of the time - nothing live. Quick
// battles run about ten minutes on weeknights, so a widget that only looks
// right mid-battle would look broken all day. The finished-battle state is the
// default, not the fallback.
// ---------------------------------------------------------------------------

function BattleSide({
  name, pool, art, share, won, opts, dim,
}: {
  name: string; pool: number; art: string | null; share: number;
  won: boolean; opts: EmbedOptions; dim: boolean;
}) {
  const p = opts.palette;
  return (
    <div style={{ flex: 1, minWidth: 0, opacity: dim ? 0.55 : 1 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" style={{
            width: 34, height: 34, borderRadius: 5, objectFit: "cover", flexShrink: 0,
          }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: p.ice, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{name}</div>
          <div style={{ color: won ? p.green : p.mut, fontFamily: FONTS.mono, fontSize: 10.5 }}>
            {won ? "WINNER" : `${num(pool, 3)} SOL`}
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
              name={battle.a.name} pool={battle.a.poolSol} art={battle.a.art}
              share={share} opts={opts}
              won={battle.winnerSide === "artist1"}
              dim={battle.settled && battle.winnerSide === "artist2"}
            />
            <div style={{ color: p.mut, fontFamily: FONTS.mono, fontSize: 11, paddingTop: 10 }}>
              VS
            </div>
            <BattleSide
              name={battle.b.name} pool={battle.b.poolSol} art={battle.b.art}
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
