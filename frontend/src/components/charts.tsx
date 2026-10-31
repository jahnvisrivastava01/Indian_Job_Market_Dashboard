import clsx from "clsx";
import { useState, type ReactNode } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useChartColors } from "../lib/theme";
import { fmtInt, fmtLPA } from "../lib/format";

/* ------------------------------------------------------------------ */
/* Shared tooltip shell                                                */
/* ------------------------------------------------------------------ */
export function TipBox({ title, rows }: { title: ReactNode; rows: [string, ReactNode][] }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-ink-2">
          <span>{k}</span>
          <span className="num text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked horizontal bars (HTML — handles long labels gracefully)      */
/* ------------------------------------------------------------------ */
export type HBarItem = { label: string; value: number; sub?: ReactNode; tip?: [string, ReactNode][] };

export function HBars({
  items, format = fmtInt, onSelect, selected, max,
}: {
  items: HBarItem[]; format?: (n: number) => string; onSelect?: (label: string) => void;
  selected?: string | null; max?: number;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-[7px]">
      {items.map((it, i) => {
        const active = selected === it.label;
        const dim = selected != null && !active;
        return (
          <li
            key={it.label}
            className={clsx("group relative", onSelect && "cursor-pointer")}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(it.label)}
          >
            <div className="mb-0.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className={clsx("truncate", active ? "font-semibold text-ink" : "text-ink-2")}>{it.label}</span>
              <span className="num shrink-0 text-[12px] text-ink-2">
                {format(it.value)}
                {it.sub && <span className="ml-2 text-ink-3">{it.sub}</span>}
              </span>
            </div>
            <div className="h-[8px] w-full rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width,opacity] duration-300"
                style={{
                  width: `${Math.max((it.value / top) * 100, 1.5)}%`,
                  background: "var(--accent)",
                  opacity: dim ? 0.5 : hover === i ? 0.85 : 1,
                }}
              />
            </div>
            {hover === i && it.tip && (
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-1">
                <TipBox title={it.label} rows={it.tip} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Interquartile range bars: p25–p75 band with a median marker        */
/* ------------------------------------------------------------------ */
export function RangeBars({
  items, domainMax,
}: { items: { name: string; p25: number; p50: number; p75: number; n: number }[]; domainMax?: number }) {
  const max = domainMax ?? Math.max(...items.map((i) => i.p75), 1) * 1.05;
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(max);
  return (
    <div>
      <div className="grid grid-cols-[minmax(90px,170px)_1fr] gap-x-3">
        <div />
        <div className="relative mb-1 h-4">
          {ticks.map((t) => (
            <span key={t} className="num absolute -translate-x-1/2 text-[10.5px] text-ink-3" style={{ left: `${(t / max) * 100}%` }}>
              {fmtLPA(t, 0)}
            </span>
          ))}
        </div>
        {items.map((it, i) => (
          <div key={it.name} className="contents">
            <div className="truncate py-[5px] text-[13px] text-ink-2" title={it.name}>{it.name}</div>
            <div
              className="relative h-[28px]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {ticks.map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-[var(--grid)]" style={{ left: `${(t / max) * 100}%` }} />
              ))}
              <div
                className="absolute top-1/2 h-[10px] -translate-y-1/2 rounded-full"
                style={{
                  left: `${(it.p25 / max) * 100}%`,
                  width: `${Math.max(((it.p75 - it.p25) / max) * 100, 0.8)}%`,
                  background: "color-mix(in oklab, var(--accent) 35%, var(--surface))",
                }}
              />
              <div
                className="absolute top-1/2 h-[16px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                style={{ left: `${(it.p50 / max) * 100}%`, background: "var(--accent)" }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute z-20 -translate-x-1/2" style={{ left: `${(it.p50 / max) * 100}%`, top: 26 }}>
                  <TipBox
                    title={it.name}
                    rows={[["Median", fmtLPA(it.p50)], ["Middle 50%", `${fmtLPA(it.p25)} – ${fmtLPA(it.p75)}`], ["Listings w/ salary", fmtInt(it.n)]]}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[8px] w-5 rounded-full" style={{ background: "color-mix(in oklab, var(--accent) 35%, var(--surface))" }} />
          Middle 50% (P25–P75)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-[4px] rounded-full bg-accent" /> Median
        </span>
      </div>
    </div>
  );
}

function niceTicks(max: number) {
  const steps = [1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7];
  const step = steps.find((s) => max / s <= 5) ?? 1e7;
  const out: number[] = [];
  for (let t = 0; t <= max * 0.98; t += step) out.push(t);
  return out;
}

/* ------------------------------------------------------------------ */
/* Columns (Recharts)                                                  */
/* ------------------------------------------------------------------ */
export function Columns({
  data, x, y, height = 240, xFormat, yFormat = (n: number) => fmtInt(n), tipLabel = "Listings", tipX,
}: {
  data: Record<string, string | number>[]; x: string; y: string; height?: number;
  xFormat?: (v: string | number) => string; yFormat?: (n: number) => string; tipLabel?: string;
  tipX?: (v: string | number) => string;
}) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey={x} tickLine={false} axisLine={{ stroke: c.line }} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => yFormat(v)} width={52} />
        <Tooltip
          cursor={{ fill: c.ink, fillOpacity: 0.05 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox
                title={tipX ? tipX(payload[0].payload[x]) : String(payload[0].payload[x])}
                rows={[[tipLabel, yFormat(Number(payload[0].value))]]}
              />
            ) : null
          }
        />
        <Bar dataKey={y} fill={c.accent} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Salary-by-experience curve with P10–P90 band                       */
/* ------------------------------------------------------------------ */
export function BandCurve({
  data, height = 260, marker,
}: { data: { exp: number; p10: number; p50: number; p90: number }[]; height?: number; marker?: number }) {
  const c = useChartColors();
  const rows = data.map((d) => ({ ...d, band: [d.p10, d.p90] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="exp" tickLine={false} axisLine={{ stroke: c.line }} tickFormatter={(v) => `${v}y`} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtLPA(v, 0)} width={56} />
        <Tooltip
          cursor={{ stroke: c.ink3, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox
                title={`${payload[0].payload.exp} yrs experience`}
                rows={[
                  ["P90", fmtLPA(payload[0].payload.p90)],
                  ["Median", fmtLPA(payload[0].payload.p50)],
                  ["P10", fmtLPA(payload[0].payload.p10)],
                ]}
              />
            ) : null
          }
        />
        <Area dataKey="band" stroke="none" fill={c.accent} fillOpacity={0.14} isAnimationActive={false} />
        <Line dataKey="p50" stroke={c.accent} strokeWidth={2} dot={false} isAnimationActive={false}
          activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
        {marker != null && (
          <ReferenceLine x={marker} stroke={c.ink3} strokeDasharray="4 4"
            label={{ value: "you", position: "insideTopRight", fill: c.ink2, fontSize: 11 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Part-to-whole: a single segmented bar (≤ 3 fixed categorical slots) */
/* ------------------------------------------------------------------ */
const MODE_COLOR: Record<string, string> = {
  "On-site": "var(--series-1)",
  Hybrid: "var(--series-2)",
  Remote: "var(--series-3)",
};

export function SegmentBar({ parts }: { parts: { name: string; count: number }[] }) {
  const total = parts.reduce((a, p) => a + p.count, 0) || 1;
  const order = ["On-site", "Hybrid", "Remote"];
  const sorted = [...parts].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {sorted.map((p) => (
          <div
            key={p.name}
            title={`${p.name}: ${fmtInt(p.count)} (${((p.count / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(p.count / total) * 100}%`, background: MODE_COLOR[p.name] ?? "var(--ink-3)", minWidth: p.count ? 3 : 0 }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {sorted.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MODE_COLOR[p.name] }} />
            <span className="text-ink-2">{p.name}</span>
            <span className="num text-ink">{((p.count / total) * 100).toFixed(1)}%</span>
            <span className="num text-xs text-ink-3">({fmtInt(p.count)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { MODE_COLOR };

/* ------------------------------------------------------------------ */
/* Heatmap: one-hue sequential ramp of the accent                      */
/* ------------------------------------------------------------------ */
export function Heatmap({
  rows, cols, values, share, mode,
}: { rows: string[]; cols: string[]; values: number[][]; share: number[][]; mode: "count" | "share" }) {
  const data = mode === "count" ? values : share;
  const max = Math.max(...data.flat(), 1e-9);
  const [hover, setHover] = useState<[number, number] | null>(null);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `128px repeat(${cols.length}, minmax(64px, 1fr))` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="flex h-16 items-end px-1 pb-1 text-[11px] leading-tight text-ink-3" title={c}>
            <span className="line-clamp-3">{c}</span>
          </div>
        ))}
        {rows.map((r, i) => (
          <div key={r} className="contents">
            <div className="flex items-center truncate pr-2 text-[13px] text-ink-2">{r}</div>
            {cols.map((c, j) => {
              const v = data[i][j];
              const t = Math.sqrt(v / max); // sqrt keeps small cells visible
              const pct = Math.round(6 + t * 88);
              const dark = t > 0.55;
              const isH = hover?.[0] === i && hover?.[1] === j;
              return (
                <div
                  key={c}
                  onMouseEnter={() => setHover([i, j])}
                  onMouseLeave={() => setHover(null)}
                  className={clsx("relative flex h-10 items-center justify-center rounded-[4px] text-[11.5px] num", isH && "ring-2 ring-ink")}
                  style={{
                    background: `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`,
                    color: dark ? "var(--accent-ink)" : "var(--ink-2)",
                  }}
                >
                  {mode === "count" ? (values[i][j] >= 1000 ? `${(values[i][j] / 1000).toFixed(1)}k` : values[i][j]) : `${(share[i][j] * 100).toFixed(0)}%`}
                  {isH && (
                    <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2">
                      <TipBox title={`${c} · ${r}`} rows={[["Listings", fmtInt(values[i][j])], [`Share of ${r}`, `${(share[i][j] * 100).toFixed(1)}%`]]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-3">
        <span>Fewer</span>
        <div className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--accent) 6%, var(--surface)), var(--accent))" }} />
        <span>More</span>
      </div>
    </div>
  );
}
