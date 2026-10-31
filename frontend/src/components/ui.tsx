import clsx from "clsx";
import { AlertTriangle, Info, SearchX } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Card({
  title, sub, actions, children, className, pad = true,
}: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={clsx("card min-w-0", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="h-section">{title}</h2>}
            {sub && <p className="sub mt-0.5">{sub}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(pad && "px-5 pb-5 pt-3")}>{children}</div>
    </section>
  );
}

export function Stat({
  label, value, hint, loading,
}: { label: string; value: ReactNode; hint?: ReactNode; loading?: boolean }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      {loading ? (
        <div className="skeleton mt-2 h-7 w-24" />
      ) : (
        <div className="num mt-1 text-[24px] font-semibold leading-tight text-ink">{value}</div>
      )}
      {hint && <div className="mt-1 text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}

export function Skeleton({ h = 260 }: { h?: number }) {
  return <div className="skeleton w-full" style={{ height: h }} />;
}

export function Empty({ msg = "No listings match these filters." }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-ink-3">
      <SearchX size={22} />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--bad)]" />
      <div>
        Couldn’t load data. Is the API running on port 8000?
        <div className="mt-1 text-xs text-ink-3">{String((error as Error)?.message ?? error)}</div>
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
      <Info size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-2">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Chart / table toggle wrapper — every chart has a table view for accessibility. */
export function ChartOrTable({
  chart, table,
}: { chart: ReactNode; table: { cols: string[]; rows: (string | number)[][] } }) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  return (
    <div>
      <div className="-mt-1 mb-2 flex justify-end">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]}
        />
      </div>
      {mode === "chart" ? chart : <DataTable cols={table.cols} rows={table.rows} />}
    </div>
  );
}

export function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-ink-3">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((v, j) => (
                <td key={j} className={clsx("px-3 py-1.5", j > 0 && "num text-ink-2")}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
