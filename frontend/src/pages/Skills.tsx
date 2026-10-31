import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Search, Target, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HBars, RangeBars } from "../components/charts";
import { Select, TagInput } from "../components/inputs";
import { Card, ChartOrTable, Empty, ErrorBox, Note, PageHeader, Skeleton, Stat } from "../components/ui";
import { useMeta, useSkillDetail, useSkills } from "../hooks/queries";
import { post, type Gap } from "../lib/api";
import { useFilters } from "../lib/filters";
import { fmtInt, fmtLPA, fmtPct, fmtSignedPct, titleCase } from "../lib/format";

export default function Skills() {
  const { data, isLoading, error, isFetching } = useSkills();
  const { data: meta } = useMeta();
  const [params, setParams] = useSearchParams();
  const selected = params.get("skill");
  const select = (s: string | null) =>
    setParams((p) => { const n = new URLSearchParams(p); s ? n.set("skill", s) : n.delete("skill"); return n; }, { replace: true });

  useEffect(() => {
    if (!selected && data && !data.empty && data.top[0]) select(data.top[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selected]);

  const loading = isLoading || !data;

  return (
    <div className={isFetching && !isLoading ? "opacity-70 transition-opacity" : ""}>
      <PageHeader title="Skills" sub="Which skills employers ask for, which ones pay more, and how your own skills compare." />
      {error && <ErrorBox error={error} />}
      {data?.empty ? <div className="card"><Empty /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Listings in view" value={fmtInt(data?.listings)} loading={loading} />
            <Stat label="Distinct skills" value={fmtInt(data?.uniqueSkills)} loading={loading} />
            <Stat label="Skills per listing" value={data?.avgSkillsPerListing?.toFixed(1) ?? "—"} loading={loading} />
            <Stat label="Baseline median pay" value={fmtLPA(data?.baselineMedian)} loading={loading} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card title="Most in-demand" sub="Share of listings mentioning the skill · click to inspect" className="lg:col-span-2">
              {meta && <SkillSearch vocabulary={meta.skills} onPick={select} />}
              <div className="mt-4">
                {loading ? <Skeleton h={560} /> : (
                  <HBars
                    items={data.top.slice(0, 20).map((s) => ({
                      label: titleCase(s.name), value: s.share,
                      tip: [["Listings", fmtInt(s.count)], ["Share", fmtPct(s.share, 1)], ["Median pay", fmtLPA(s.medianSalary)]],
                    }))}
                    format={(n) => fmtPct(n, 1)}
                    selected={selected ? titleCase(selected) : null}
                    onSelect={(l) => { const hit = data.top.find((t) => titleCase(t.name) === l); if (hit) select(hit.name); }}
                  />
                )}
              </div>
            </Card>
            <div className="lg:col-span-3">
              <SkillPanel name={selected} onPick={select} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card
              title={<span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-accent" />Best-paying skills</span>}
              sub={data ? `Median disclosed salary of listings mentioning the skill, vs ${fmtLPA(data.baselineMedian)} overall · min ${data.premiumMinSample} salaries` : ""}
            >
              {loading ? <Skeleton h={480} /> : data.premium.length ? (
                <ChartOrTable
                  chart={
                    <HBars
                      items={data.premium.slice(0, 15).map((s) => ({
                        label: titleCase(s.name), value: s.medianSalary, sub: fmtSignedPct(s.premium),
                        tip: [["Median pay", fmtLPA(s.medianSalary)], ["vs overall", fmtSignedPct(s.premium)], ["Salaries", fmtInt(s.disclosed)]],
                      }))}
                      format={(n) => fmtLPA(n)}
                      onSelect={(l) => { const hit = data.premium.find((t) => titleCase(t.name) === l); if (hit) select(hit.name); }}
                    />
                  }
                  table={{ cols: ["Skill", "Median", "vs overall", "Salaries"], rows: data.premium.map((s) => [titleCase(s.name), fmtLPA(s.medianSalary), fmtSignedPct(s.premium), fmtInt(s.disclosed)]) }}
                />
              ) : <Empty msg="Not enough disclosed salaries in this selection." />}
              <div className="mt-3"><Note>Correlation, not causation: these skills tend to appear in senior roles, so part of the gap is experience.</Note></div>
            </Card>
            <Card title="Skills that come as a pair" sub="Most frequent pairs among the top 40 skills">
              {loading ? <Skeleton h={480} /> : (
                <ul className="divide-y divide-line">
                  {data.pairs.map((p) => (
                    <li key={p.a + p.b} className="flex items-center gap-2 py-2 text-[13px]">
                      <button className="chip hover:border-accent" onClick={() => select(p.a)}>{titleCase(p.a)}</button>
                      <span className="text-ink-3">+</span>
                      <button className="chip hover:border-accent" onClick={() => select(p.b)}>{titleCase(p.b)}</button>
                      <span className="num ml-auto text-ink-3">{fmtInt(p.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {meta && <GapTool roles={meta.roles.map((r) => r.name).filter((r) => r !== "Other")} cities={meta.cities.slice(0, 40).map((c) => c.name)} vocabulary={meta.skills} />}
        </>
      )}
    </div>
  );
}

function SkillSearch({ vocabulary, onPick }: { vocabulary: { name: string; count: number }[]; onPick: (s: string) => void }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const hits = ql ? vocabulary.filter((v) => v.name.includes(ql)).sort((a, b) => Number(b.name.startsWith(ql)) - Number(a.name.startsWith(ql))).slice(0, 6) : [];
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
        <Search size={15} className="text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up any skill — e.g. fastapi, tableau, gst"
          className="w-full bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-3"
          onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { onPick(hits[0].name); setQ(""); } }} />
      </div>
      {hits.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full rounded-lg border border-line bg-surface py-1 shadow-xl">
          {hits.map((h) => (
            <li key={h.name}>
              <button onClick={() => { onPick(h.name); setQ(""); }} className="flex w-full justify-between px-3 py-1.5 text-left text-sm text-ink-2 hover:bg-surface-2">
                {titleCase(h.name)} <span className="num text-xs text-ink-3">{fmtInt(h.count)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillPanel({ name, onPick }: { name: string | null; onPick: (s: string) => void }) {
  const { data: d, isLoading, error } = useSkillDetail(name);
  const { setFilters, filters } = useFilters();
  if (!name) return <Card title="Skill detail"><Skeleton h={500} /></Card>;
  if (error) return <Card title={titleCase(name)}><ErrorBox error={error} /></Card>;
  if (isLoading || !d) return <Card title={titleCase(name)}><Skeleton h={560} /></Card>;
  if (d.empty) return <Card title={titleCase(name)}><Empty msg="No listings with this skill in the current filters." /></Card>;
  const premium = d.medianSalary && d.medianWithout ? d.medianSalary / d.medianWithout - 1 : null;
  return (
    <Card
      title={<span className="text-[17px]">{titleCase(d.name)}</span>}
      sub={`Mentioned in ${fmtInt(d.count)} listings (${fmtPct(d.share, 1)} of the current view)`}
      actions={
        !filters.skills.includes(d.name) && (
          <button className="btn text-xs" onClick={() => setFilters({ skills: [...filters.skills, d.name] })}>Filter dashboard by this skill</button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Median pay" value={fmtLPA(d.medianSalary)} />
        <MiniStat label="Without this skill" value={fmtLPA(d.medianWithout)} />
        <MiniStat label="Difference" value={fmtSignedPct(premium)} />
        <MiniStat label="Median experience" value={d.medianExp != null ? `${d.medianExp} yrs` : "—"} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <div className="label">Often listed alongside</div>
          <div className="flex flex-wrap gap-1.5">
            {d.related.slice(0, 14).map((r) => (
              <button key={r.name} onClick={() => onPick(r.name)} className="chip hover:border-accent" title={`In ${fmtPct(r.share)} of ${d.name} listings · ${r.lift?.toFixed(1)}× more likely than average`}>
                {titleCase(r.name)} <span className="num text-ink-3">{fmtPct(r.share)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Where it’s wanted</div>
          <HBars items={d.cities.slice(0, 6).map((c) => ({ label: c.name, value: c.count }))} />
        </div>
        <div>
          <div className="label">Role families asking for it</div>
          <HBars items={d.roles.slice(0, 6).map((c) => ({ label: c.name, value: c.count }))} />
        </div>
        <div>
          <div className="label">Top employers</div>
          <ul className="space-y-1 text-[13px]">
            {d.companies.slice(0, 7).map((c) => (
              <li key={c.name} className="flex justify-between gap-2"><span className="truncate text-ink-2">{c.name}</span><span className="num text-ink-3">{fmtInt(c.count)}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {d.byExperience.length > 1 && (
        <div className="mt-5">
          <div className="label">Pay by experience for this skill</div>
          <RangeBars items={d.byExperience} />
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[16px] font-semibold text-ink">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skill-gap analyser                                                 */
/* ------------------------------------------------------------------ */
function GapTool({ roles, cities, vocabulary }: { roles: string[]; cities: string[]; vocabulary: { name: string; count: number }[] }) {
  const [mine, setMine] = useState<string[]>(["python", "sql", "react", "node.js", "git"]);
  const [role, setRole] = useState(roles.includes("Software Engineering") ? "Software Engineering" : roles[0]);
  const [city, setCity] = useState("");
  const m = useMutation({ mutationFn: () => post<Gap>("/skills/gap", { skills: mine, role, city: city || null }) });
  const g = m.data;

  return (
    <Card
      className="mt-4"
      title={<span className="inline-flex items-center gap-2"><Target size={16} className="text-accent" />Skill-gap check</span>}
      sub="Enter your skills and a target role family. We compare them against the 30 skills those listings ask for most."
    >
      <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto] md:items-end">
        <div>
          <label className="label">Your skills</label>
          <TagInput value={mine} onChange={setMine} vocabulary={vocabulary} />
        </div>
        <div>
          <label className="label">Target role family</label>
          <Select value={role} onChange={setRole} options={roles} />
        </div>
        <div>
          <label className="label">City (optional)</label>
          <Select value={city} onChange={setCity} options={[{ value: "", label: "All India" }, ...cities.map((c) => ({ value: c, label: c }))]} />
        </div>
        <button className="btn-accent h-[42px]" disabled={!mine.length || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "Checking…" : "Check my fit"}
        </button>
      </div>
      {m.error && <div className="mt-4"><ErrorBox error={m.error} /></div>}

      {g && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="rounded-xl border border-line p-4">
              <div className="text-xs text-ink-3">Demand coverage</div>
              <div className="num mt-1 text-[34px] font-semibold leading-none text-ink">{fmtPct(g.coverage)}</div>
              <div className="mt-3 h-2 rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${g.coverage * 100}%` }} />
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
                Weighted share of {g.role} skill demand you cover, across {fmtInt(g.poolSize)} listings
                {city && (g.scopedToCity ? ` in ${city}` : ` (too few in ${city}, showing all India)`)}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Strong-match listings" value={fmtInt(g.matchingJobs)} />
              <MiniStat label="Listings with ≥1 match" value={fmtInt(g.anyOverlapJobs)} />
            </div>
            {g.unknown.length > 0 && <Note>Not found in any listing: {g.unknown.join(", ")}.</Note>}
          </div>

          <div>
            <div className="label">Learn next</div>
            <p className="-mt-1 mb-2 text-[12px] text-ink-3">Missing skills ranked by demand, weighted up if they pay above the role median.</p>
            <ol className="space-y-2">
              {g.recommend.map((r, i) => (
                <li key={r.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                  <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{titleCase(r.name)}</div>
                    <div className="text-[12px] text-ink-3">
                      in {fmtPct(r.share)} of listings{r.premium != null && ` · ${fmtSignedPct(r.premium)} pay vs role median`}
                    </div>
                  </div>
                  <button className="text-xs font-medium text-accent hover:underline" onClick={() => setMine([...mine, r.name])}>I have it</button>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="label">Top skills for {g.role}</div>
            <ul className="max-h-[360px] space-y-1 overflow-auto pr-1">
              {g.demand.map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-[13px]">
                  <span className={clsx("flex h-4 w-4 items-center justify-center rounded-full", d.have ? "bg-[var(--good)] text-white" : "border border-line text-ink-3")}>
                    {d.have ? <Check size={10} strokeWidth={3} /> : <X size={9} />}
                  </span>
                  <span className={clsx("flex-1 truncate", d.have ? "text-ink" : "text-ink-2")}>{titleCase(d.name)}</span>
                  <div className="h-1.5 w-20 rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(d.share / g.demand[0].share) * 100}%`, background: d.have ? "var(--good)" : "var(--ink-3)" }} />
                  </div>
                  <span className="num w-9 text-right text-[11.5px] text-ink-3">{fmtPct(d.share)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
