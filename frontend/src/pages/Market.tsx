import { ArrowDownUp, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Columns, Heatmap, HBars, MODE_COLOR } from "../components/charts";
import { Card, ChartOrTable, Empty, ErrorBox, PageHeader, Segmented, Skeleton, Stat } from "../components/ui";
import { useMarket } from "../hooks/queries";
import { fmtInt, fmtLPA, fmtPct } from "../lib/format";

type SortKey = "listings" | "rating" | "medianSalary" | "reviews";

export default function Market() {
  const { data, isLoading, error, isFetching } = useMarket();
  const [heatMode, setHeatMode] = useState<"count" | "share">("share");
  const [sort, setSort] = useState<SortKey>("listings");
  const loading = isLoading || !data;

  const companies = useMemo(() => {
    if (!data || data.empty) return [];
    return [...data.companies].sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number));
  }, [data, sort]);

  if (data?.empty) return (<><PageHeader title="Job Market" sub="" /><div className="card"><Empty /></div></>);

  const sen = data?.seniority.filter((s) => s.name !== "Not stated") ?? [];
  const senKnown = sen.reduce((a, s) => a + s.count, 0);

  return (
    <div className={isFetching && !isLoading ? "opacity-70 transition-opacity" : ""}>
      <PageHeader title="Job Market" sub="Where each kind of role is concentrated, and who’s doing the hiring." />
      {error && <ErrorBox error={error} />}

      <Card
        title="City × role family"
        sub={heatMode === "share" ? "Each row sums to 100% across all role families — read across a row to compare a city’s mix" : "Raw listing counts"}
        actions={<Segmented value={heatMode} onChange={setHeatMode} options={[{ value: "share", label: "% of city" }, { value: "count", label: "Count" }]} />}
      >
        {loading ? <Skeleton h={460} /> : (
          <Heatmap rows={data.heatmap.cities} cols={data.heatmap.roles} values={data.heatmap.values} share={data.heatmap.rowShare} mode={heatMode} />
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Top employers" sub="Click a column header to sort" className="lg:col-span-2" pad={false}>
          {loading ? <div className="p-5"><Skeleton h={420} /></div> : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface text-left text-xs text-ink-3">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 font-medium">Company</th>
                    <SortTh k="listings" cur={sort} set={setSort}>Listings</SortTh>
                    <SortTh k="rating" cur={sort} set={setSort}>Rating</SortTh>
                    <SortTh k="reviews" cur={sort} set={setSort} className="hidden md:table-cell">Reviews</SortTh>
                    <SortTh k="medianSalary" cur={sort} set={setSort}>Median pay</SortTh>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Main role family</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.name} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="max-w-[220px] truncate px-5 py-2 text-ink" title={c.name}>{c.name}</td>
                      <td className="num px-3 py-2 text-right text-ink-2">{fmtInt(c.listings)}</td>
                      <td className="num px-3 py-2 text-right text-ink-2">
                        {c.rating != null ? <span className="inline-flex items-center gap-1"><Star size={11} className="fill-current text-[var(--warn)]" />{c.rating.toFixed(1)}</span> : "—"}
                      </td>
                      <td className="num hidden px-3 py-2 text-right text-ink-3 md:table-cell">{c.reviews != null ? fmtInt(c.reviews) : "—"}</td>
                      <td className="num px-3 py-2 text-right text-ink-2">{fmtLPA(c.medianSalary)}</td>
                      <td className="hidden truncate px-3 py-2 text-ink-3 lg:table-cell">{c.topRole}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Top-10 employer share" value={fmtPct(data?.companyConcentration, 1)} hint="of listings in view" loading={loading} />
            <Stat label="Title states seniority" value={data ? fmtPct(senKnown / data.seniority.reduce((a, s) => a + s.count, 0)) : "—"} loading={loading} />
          </div>
          <Card title="Seniority in titles" sub="Only where the title says it">
            {loading ? <Skeleton h={220} /> : (
              <HBars items={sen.map((s) => ({ label: s.name, value: s.count, tip: [["Listings", fmtInt(s.count)], ["Share (of stated)", fmtPct(s.count / (senKnown || 1), 1)]] }))} />
            )}
          </Card>
          <Card title="Company ratings" sub="Distinct companies with a rating">
            {loading ? <Skeleton h={180} /> : (
              <ChartOrTable
                chart={<Columns data={data.ratingDist} x="band" y="count" height={170} tipLabel="Companies" />}
                table={{ cols: ["Rating", "Companies"], rows: data.ratingDist.map((r) => [r.band, fmtInt(r.count)]) }}
              />
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Remote & hybrid by role family" sub="Share of each family’s listings that aren’t fully on-site">
          {loading ? <Skeleton h={300} /> : (
            <div className="space-y-2.5">
              {data.workModeByRole
                .map((r) => {
                  const on = Number(r["On-site"] ?? 0), hy = Number(r["Hybrid"] ?? 0), re = Number(r["Remote"] ?? 0);
                  return { name: String(r.name), on, hy, re, tot: on + hy + re };
                })
                .sort((a, b) => (b.hy + b.re) / b.tot - (a.hy + a.re) / a.tot)
                .map((r, _i, arr) => {
                  const scale = Math.max(...arr.map((x) => (x.hy + x.re) / x.tot), 0.01);
                  return (
                  <div key={r.name}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate text-ink-2">{r.name}</span>
                      <span className="num text-[12px] text-ink-2">{fmtPct((r.hy + r.re) / r.tot, 1)}</span>
                    </div>
                    <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-2">
                      <div style={{ width: `${(r.hy / r.tot / scale) * 100}%`, background: MODE_COLOR.Hybrid }} title={`Hybrid ${fmtPct(r.hy / r.tot, 1)}`} />
                      <div style={{ width: `${(r.re / r.tot / scale) * 100}%`, background: MODE_COLOR.Remote }} title={`Remote ${fmtPct(r.re / r.tot, 1)}`} />
                    </div>
                  </div>
                  );
                })}
              <div className="flex gap-4 pt-1 text-[11.5px] text-ink-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: MODE_COLOR.Hybrid }} />Hybrid</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: MODE_COLOR.Remote }} />Remote</span>
                <span>Full bar width = the highest share shown</span>
              </div>
            </div>
          )}
        </Card>
        <Card title="Top 20 job titles" sub="Cleaned titles">
          {loading ? <Skeleton h={300} /> : (
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {data.topTitles.map((t, i) => (
                <div key={t.name} className="flex items-baseline gap-2 border-b border-line py-1.5 text-[13px]">
                  <span className="num w-5 text-ink-3">{i + 1}</span>
                  <span className="flex-1 truncate text-ink-2" title={t.name}>{t.name}</span>
                  <span className="num text-ink-3">{fmtInt(t.count)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SortTh({ k, cur, set, children, className = "" }: { k: SortKey; cur: SortKey; set: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-right font-medium ${className}`}>
      <button onClick={() => set(k)} className={`inline-flex items-center gap-1 ${cur === k ? "text-ink" : "hover:text-ink"}`}>
        {children}<ArrowDownUp size={11} className={cur === k ? "text-accent" : ""} />
      </button>
    </th>
  );
}
