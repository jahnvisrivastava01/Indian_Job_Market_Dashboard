import { useState } from "react";
import { Columns, RangeBars } from "../components/charts";
import { Card, ChartOrTable, Empty, ErrorBox, Note, PageHeader, Segmented, Skeleton, Stat } from "../components/ui";
import { useSalary } from "../hooks/queries";
import { fmtInt, fmtLPA, fmtPct } from "../lib/format";
import type { Quartile } from "../lib/api";

type Dim = "byRole" | "byCity" | "bySeniority" | "byMode";
const DIMS: { value: Dim; label: string }[] = [
  { value: "byRole", label: "Role family" },
  { value: "byCity", label: "City" },
  { value: "bySeniority", label: "Seniority" },
  { value: "byMode", label: "Work mode" },
];

const qTable = (rows: Quartile[], first: string) => ({
  cols: [first, "P25", "Median", "P75", "n"],
  rows: rows.map((r) => [r.name, fmtLPA(r.p25), fmtLPA(r.p50), fmtLPA(r.p75), fmtInt(r.n)]),
});

export default function Salary() {
  const { data, isLoading, error, isFetching } = useSalary();
  const [dim, setDim] = useState<Dim>("byRole");
  const loading = isLoading || !data;
  const p = data?.percentiles;

  return (
    <div className={isFetching && !isLoading ? "opacity-70 transition-opacity" : ""}>
      <PageHeader title="Salaries" sub="Annual pay from listings that disclose it. Medians and quartiles, not averages, because a handful of very high salaries pull the mean up." />
      {error && <ErrorBox error={error} />}
      {data?.empty ? <div className="card"><Empty msg="Too few disclosed salaries for this selection." /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="P10" value={fmtLPA(p?.p10)} loading={loading} />
            <Stat label="P25" value={fmtLPA(p?.p25)} loading={loading} />
            <Stat label="Median" value={fmtLPA(p?.p50)} loading={loading} hint={data ? `mean ${fmtLPA(data.mean)}` : undefined} />
            <Stat label="P75" value={fmtLPA(p?.p75)} loading={loading} />
            <Stat label="P90" value={fmtLPA(p?.p90)} loading={loading} />
          </div>
          {data && (
            <div className="mt-3">
              <Note>Based on <b className="num text-ink-2">{fmtInt(data.disclosed)}</b> of {fmtInt(data.total)} listings ({fmtPct(data.disclosed / data.total)}) that state a salary. Salary is the midpoint of the advertised range; USD listings and implausible values are excluded.</Note>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card title="Distribution" sub="Annual salary in lakhs, shown up to P99" className="lg:col-span-3">
              {loading ? <Skeleton h={260} /> : (
                <ChartOrTable
                  chart={<Columns data={data.histogram} x="lpa" y="count" height={260} xFormat={(v) => `${v}L`} tipX={(v) => `≈ ₹${v} L`} />}
                  table={{ cols: ["Bin centre (L)", "Listings"], rows: data.histogram.map((h) => [h.lpa, fmtInt(h.count)]) }}
                />
              )}
            </Card>
            <Card title="By experience" sub="Median and middle 50%" className="lg:col-span-2">
              {loading ? <Skeleton h={260} /> : (
                <ChartOrTable chart={<RangeBars items={data.byExperience} />} table={qTable(data.byExperience, "Experience")} />
              )}
            </Card>
          </div>

          <Card
            className="mt-4"
            title="Pay comparison"
            sub="Groups with too few disclosed salaries are hidden"
            actions={<Segmented value={dim} onChange={setDim} options={DIMS} />}
          >
            {loading ? <Skeleton h={420} /> : data[dim].length ? (
              <ChartOrTable chart={<RangeBars items={data[dim]} />} table={qTable(data[dim], DIMS.find((d) => d.value === dim)!.label)} />
            ) : <Empty msg="Not enough data for this breakdown." />}
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Salary bands">
              {loading ? <Skeleton h={220} /> : (
                <ChartOrTable
                  chart={<Columns data={data.bands} x="band" y="count" height={220} />}
                  table={{ cols: ["Band", "Listings"], rows: data.bands.map((b) => [b.band, fmtInt(b.count)]) }}
                />
              )}
            </Card>
            <Card title="Highest-paying listings" sub="Top 10 by salary midpoint">
              {loading ? <Skeleton h={220} /> : (
                <ul className="divide-y divide-line">
                  {data.topPaying.map((t) => (
                    <li key={t.jobId} className="flex items-center gap-3 py-1.5 text-[13px]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-ink">{t.title}</div>
                        <div className="truncate text-[12px] text-ink-3">{t.company} · {t.city}</div>
                      </div>
                      <span className="num shrink-0 text-ink-2">{fmtLPA(t.salary)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
