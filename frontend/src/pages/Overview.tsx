import { Lightbulb } from "lucide-react";
import { Columns, HBars, SegmentBar } from "../components/charts";
import { Card, ChartOrTable, Empty, ErrorBox, PageHeader, Skeleton, Stat } from "../components/ui";
import { useOverview } from "../hooks/queries";
import { useFilters } from "../lib/filters";
import { fmtInt, fmtLPA, fmtPct, titleCase } from "../lib/format";

export default function Overview() {
  const { data, isLoading, error, isFetching } = useOverview();
  const { filters, setFilters } = useFilters();
  const k = data?.kpis;
  const loading = isLoading || !data;

  return (
    <div className={isFetching && !isLoading ? "opacity-70 transition-opacity" : ""}>
      <PageHeader
        title="Indian Job Market Overview"
        sub="Who’s hiring, where, for what, and at what pay. Click a bar to filter by it."
      />
      {error && <ErrorBox error={error} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Job listings" value={fmtInt(k?.listings)} loading={loading} />
        <Stat label="Companies hiring" value={fmtInt(k?.companies)} loading={loading} />
        <Stat label="Cities" value={fmtInt(k?.cities)} loading={loading} />
        <Stat label="Median salary" value={fmtLPA(k?.medianSalary)} hint="per year, disclosed only" loading={loading} />
        <Stat label="Salary disclosed" value={fmtPct(k?.disclosedPct)} loading={loading} />
        <Stat label="Remote / hybrid" value={fmtPct(k?.flexiblePct, 1)} loading={loading} />
      </div>

      {data?.empty ? (
        <div className="card mt-4"><Empty /></div>
      ) : (
        <>
          {data && (
            <div className="card mt-4 flex gap-3 px-5 py-4">
              <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" />
              <ul className="grid flex-1 gap-x-8 gap-y-1.5 text-[13.5px] text-ink-2 md:grid-cols-2">
                {data.insights.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Role families" sub="Listings by job family · median pay where ≥15 salaries disclosed">
              {loading ? <Skeleton h={380} /> : (
                <HBars
                  items={data.roles.slice(0, 12).map((r) => ({
                    label: r.name, value: r.count, sub: r.medianSalary ? fmtLPA(r.medianSalary) : undefined,
                    tip: [["Listings", fmtInt(r.count)], ["Median salary", fmtLPA(r.medianSalary)]],
                  }))}
                  selected={filters.roles.length === 1 ? filters.roles[0] : null}
                  onSelect={(l) => setFilters({ roles: filters.roles.includes(l) ? [] : [l] })}
                />
              )}
            </Card>
            <Card title="Top hiring cities" sub="Multi-city listings count once in each city">
              {loading ? <Skeleton h={380} /> : (
                <HBars
                  items={data.cities.map((c) => ({ label: c.name, value: c.count, tip: [["Listings", fmtInt(c.count)], ["Share", fmtPct(c.count / data.kpis.listings, 1)]] }))}
                  selected={filters.cities.length === 1 ? filters.cities[0] : null}
                  onSelect={(l) => setFilters({ cities: filters.cities.includes(l) ? [] : [l] })}
                />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="Salary bands" sub="Disclosed annual salary (midpoint)" className="lg:col-span-1">
              {loading ? <Skeleton h={230} /> : (
                <ChartOrTable
                  chart={<Columns data={data.salaryBands} x="band" y="count" height={230} />}
                  table={{ cols: ["Band", "Listings"], rows: data.salaryBands.map((b) => [b.band, fmtInt(b.count)]) }}
                />
              )}
            </Card>
            <Card title="Experience asked" sub="Midpoint of the advertised range">
              {loading ? <Skeleton h={230} /> : (
                <ChartOrTable
                  chart={<Columns data={data.experience} x="band" y="count" height={230} />}
                  table={{ cols: ["Experience", "Listings"], rows: data.experience.map((b) => [b.band, fmtInt(b.count)]) }}
                />
              )}
            </Card>
            <Card title="Posting recency" sub="Days before collection (Sep–Oct 2025) the listing went up">
              {loading ? <Skeleton h={230} /> : (
                <ChartOrTable
                  chart={<Columns data={data.recency} x="day" y="count" height={230} xFormat={(v) => `${v}d`} tipX={(v) => (Number(v) === 0 ? "Today" : `${v} days ago`)} />}
                  table={{ cols: ["Days ago", "Listings"], rows: data.recency.map((b) => [b.day, fmtInt(b.count)]) }}
                />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="Work mode" sub="Derived from the location field">
              {loading ? <Skeleton h={80} /> : <SegmentBar parts={data.workMode} />}
            </Card>
            <Card title="Most common job titles" sub="After cleaning “Hiring for…”, locations, brackets">
              {loading ? <Skeleton h={200} /> : (
                <ol className="space-y-1.5 text-[13px]">
                  {data.topTitles.slice(0, 8).map((t, i) => (
                    <li key={t.name} className="flex items-baseline gap-2">
                      <span className="num w-4 text-ink-3">{i + 1}</span>
                      <span className="flex-1 truncate text-ink-2">{t.name}</span>
                      <span className="num text-ink-3">{fmtInt(t.count)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card title="Most requested skills">
              {loading ? <Skeleton h={200} /> : (
                <div className="flex flex-wrap gap-1.5">
                  {data.topSkills.map((s) => (
                    <button key={s.name} onClick={() => setFilters({ skills: [s.name] })} className="chip hover:border-accent">
                      {titleCase(s.name)} <span className="num text-ink-3">{fmtInt(s.count)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
