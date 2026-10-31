import { ChevronLeft, ChevronRight, Download, MapPin, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MODE_COLOR } from "../components/charts";
import { Select } from "../components/inputs";
import { JobDrawer } from "../components/JobDrawer";
import { Empty, ErrorBox, Note, PageHeader, Skeleton } from "../components/ui";
import { useJobs } from "../hooks/queries";
import { apiUrl, filtersToQuery } from "../lib/api";
import { useFilters } from "../lib/filters";
import { fmtInt, fmtLPA, postedLabel, titleCase } from "../lib/format";

const SORTS = [
  { value: "recent", label: "Newest at collection" },
  { value: "salary", label: "Highest salary" },
  { value: "rating", label: "Best-rated company" },
  { value: "experience", label: "Least experience" },
];

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "recent";
  const page = Number(params.get("page") ?? 1);
  const [draft, setDraft] = useState(q);
  const [open, setOpen] = useState<number | null>(null);
  const { filters } = useFilters();
  const { data, isLoading, error, isFetching } = useJobs(q, sort, page);

  const setParam = (k: string, v: string) =>
    setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); if (k !== "page") n.delete("page"); return n; }, { replace: true });

  useEffect(() => {
    const t = setTimeout(() => draft !== q && setParam("q", draft), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const exportHref = apiUrl(`/export.csv${filtersToQuery(filters, { q })}`);

  return (
    <div>
      <PageHeader
        title="Listings Explorer"
        sub="Search every listing behind the charts. The filters apply here too."
        right={<a className="btn" href={exportHref} download><Download size={15} />Export CSV</a>}
      />

      <div className="mb-3">
        <Note>
          Snapshot of 97,679 listings collected Sep–Oct 2025, for analysis, not active openings.
          Posting dates are relative to when the data was collected.
        </Note>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
          <Search size={16} className="text-ink-3" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search title, company or skill — e.g. “react developer”, “kotak”, “tally”"
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-3" />
        </div>
        <Select value={sort} onChange={(v) => setParam("sort", v)} options={SORTS} className="sm:w-52" />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-ink-3">
        <span>{data ? <><span className="num text-ink">{fmtInt(data.total)}</span> listings</> : " "}</span>
        {isFetching && <span className="text-xs">Updating…</span>}
      </div>

      {error && <ErrorBox error={error} />}
      <div className="mt-2 space-y-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={92} />)}
        {data?.items.length === 0 && <div className="card"><Empty msg="No listings match. Try a broader search or fewer filters." /></div>}
        {data?.items.map((j) => (
          <button key={j.jobId} onClick={() => setOpen(j.jobId)}
            className="card block w-full px-4 py-3.5 text-left transition-colors hover:border-[color-mix(in_oklab,var(--accent)_50%,var(--line))]">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-medium text-ink">{j.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2">
                  <span>{j.company}</span>
                  {j.rating != null && <span className="inline-flex items-center gap-0.5"><Star size={11} className="fill-current text-[var(--warn)]" /><span className="num">{j.rating.toFixed(1)}</span></span>}
                  <span className="inline-flex items-center gap-1 text-ink-3"><MapPin size={11} />{j.cities.join(", ") || "—"}</span>
                  <span className="inline-flex items-center gap-1 text-ink-3"><span className="h-1.5 w-1.5 rounded-full" style={{ background: MODE_COLOR[j.workMode] }} />{j.workMode}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`num text-[14px] ${j.salary ? "font-semibold text-ink" : "text-ink-3"}`}>{j.salary ? fmtLPA(j.salary) : "Not disclosed"}</div>
                <div className="text-[12px] text-ink-3">{j.experience} · {postedLabel(j.posted)}</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-ink">{j.roleCategory}</span>
              {j.skills.map((s) => <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">{titleCase(s)}</span>)}
            </div>
          </button>
        ))}
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button className="btn px-2.5" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} aria-label="Previous page"><ChevronLeft size={16} /></button>
          <span className="num text-sm text-ink-2">Page {page} of {fmtInt(pages)}</span>
          <button className="btn px-2.5" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))} aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
      )}
      <JobDrawer id={open} onClose={() => setOpen(null)} />
    </div>
  );
}