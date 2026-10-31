import { useMutation } from "@tanstack/react-query";
import { Brain, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { BandCurve, HBars } from "../components/charts";
import { Select, TagInput } from "../components/inputs";
import { JobDrawer } from "../components/JobDrawer";
import { Card, ErrorBox, Note, PageHeader, Skeleton } from "../components/ui";
import { useMeta, useModelCard } from "../hooks/queries";
import { post, type Prediction } from "../lib/api";
import { fmtInt, fmtLPA, fmtPct, titleCase } from "../lib/format";

const PRESETS = [
  { label: "Fresher full-stack dev, Bengaluru", v: { roleCategory: "Software Engineering", seniority: "Not stated", city: "Bengaluru", workMode: "On-site", expMin: 0, expMax: 2, skills: ["react", "node.js", "javascript", "mongodb"] } },
  { label: "Data analyst, Mumbai, 3 yrs", v: { roleCategory: "Data & AI", seniority: "Not stated", city: "Mumbai", workMode: "On-site", expMin: 2, expMax: 4, skills: ["sql", "python", "power bi", "excel"] } },
  { label: "Senior DevOps, Pune, hybrid", v: { roleCategory: "DevOps & Cloud", seniority: "Senior", city: "Pune", workMode: "Hybrid", expMin: 6, expMax: 9, skills: ["aws", "kubernetes", "terraform", "ci/cd"] } },
];

type Form = typeof PRESETS[number]["v"];

export default function Predictor() {
  const { data: meta } = useMeta();
  const { data: card } = useModelCard();
  const [f, setF] = useState<Form>(PRESETS[0].v);
  const [job, setJob] = useState<number | null>(null);
  const m = useMutation({ mutationFn: (body: Form) => post<Prediction>("/predict", body) });

  useEffect(() => { if (meta) m.mutate(f); /* initial run */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const p = m.data;
  const vocab = meta ? meta.predictor.skills.map((s) => ({ name: s, count: meta.skills.find((x) => x.name === s)?.count })) : [];

  return (
    <div>
      <PageHeader
        title="Salary Predictor"
        sub="Estimate a realistic pay range for a profile, using a gradient-boosting model trained on ~33K listings with a disclosed salary."
      />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card title="Profile">
          {!meta ? <Skeleton h={420} /> : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((pr) => (
                  <button key={pr.label} onClick={() => { setF(pr.v); m.mutate(pr.v); }} className="chip hover:border-accent">{pr.label}</button>
                ))}
              </div>
              <div>
                <label className="label">Role family</label>
                <Select value={f.roleCategory} onChange={(v) => set("roleCategory", v)} options={meta.predictor.roles} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">City</label>
                  <Select value={f.city} onChange={(v) => set("city", v)} options={meta.predictor.cities.map((c) => ({ value: c, label: c === "Other" ? "Other city" : c }))} />
                </div>
                <div>
                  <label className="label">Work mode</label>
                  <Select value={f.workMode} onChange={(v) => set("workMode", v)} options={meta.predictor.modes} />
                </div>
              </div>
              <div>
                <label className="label">Seniority in title</label>
                <Select value={f.seniority} onChange={(v) => set("seniority", v)} options={meta.predictor.seniority} />
              </div>
              <div>
                <label className="label">Experience: <span className="num normal-case text-ink">{f.expMin}–{f.expMax} yrs</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min={0} max={30} value={f.expMin} className="input num"
                    onChange={(e) => { const v = Math.max(0, Math.min(30, Number(e.target.value))); setF((p) => ({ ...p, expMin: v, expMax: Math.max(p.expMax, v) })); }} />
                  <input type="number" min={0} max={35} value={f.expMax} className="input num"
                    onChange={(e) => { const v = Math.max(0, Math.min(35, Number(e.target.value))); setF((p) => ({ ...p, expMax: v, expMin: Math.min(p.expMin, v) })); }} />
                </div>
              </div>
              <div>
                <label className="label">Skills</label>
                <TagInput value={f.skills} onChange={(v) => set("skills", v)} vocabulary={vocab} placeholder="Add skills…" max={15} />
                <p className="mt-1.5 text-[11.5px] text-ink-3">The model knows the {meta.predictor.skills.length} most common skills; others are ignored.</p>
              </div>
              <button className="btn-accent w-full" onClick={() => m.mutate(f)} disabled={m.isPending}>
                {m.isPending ? "Estimating…" : "Estimate salary"}
              </button>
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-4">
          {m.error && <ErrorBox error={m.error} />}
          <Card title="Estimated annual salary" sub="80% prediction interval (P10–P90) with the median estimate">
            {!p ? <Skeleton h={150} /> : (
              <div>
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div>
                    <div className="text-xs text-ink-3">Most likely</div>
                    <div className="num text-[40px] font-semibold leading-none tracking-tight text-ink">{fmtLPA(p.p50)}</div>
                  </div>
                  <div className="pb-1 text-sm text-ink-2">
                    Range <span className="num font-medium text-ink">{fmtLPA(p.p10)} – {fmtLPA(p.p90)}</span>
                    <div className="num text-xs text-ink-3">≈ ₹{fmtInt(p.p50 / 12)} / month median</div>
                  </div>
                </div>
                <RangeStrip p10={p.p10} p50={p.p50} p90={p.p90} cmp={p.comparables} />
              </div>
            )}
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Pay growth with experience" sub="Same profile, varying years of experience">
              {!p ? <Skeleton h={260} /> : (
                <BandCurve data={p.curve} marker={Math.round((f.expMin + f.expMax) / 4) * 2} />
              )}
            </Card>
            <Card title="What each skill adds" sub="Change in median estimate if the skill is removed">
              {!p ? <Skeleton h={260} /> : p.skillImpact.length ? (
                <ul className="space-y-2">
                  {p.skillImpact.map((s) => {
                    const max = Math.max(...p.skillImpact.map((x) => Math.abs(x.delta)), 1);
                    const pos = s.delta >= 0;
                    return (
                      <li key={s.skill} className="grid grid-cols-[110px_1fr_70px] items-center gap-2 text-[13px]">
                        <span className="truncate text-ink-2">{titleCase(s.skill)}</span>
                        <div className="relative h-2">
                          <span className="absolute inset-y-[-3px] left-1/2 w-px bg-[var(--line)]" />
                          <div className="absolute top-0 h-2 rounded-full"
                            style={{
                              width: `${(Math.abs(s.delta) / max) * 50}%`,
                              left: pos ? "50%" : `${50 - (Math.abs(s.delta) / max) * 50}%`,
                              background: pos ? "var(--accent)" : "var(--ink-3)",
                            }} />
                        </div>
                        <span className="num text-right text-[12px] text-ink-2">
                          {s.known ? `${pos ? "+" : "−"}₹${(Math.abs(s.delta) / 1e5).toFixed(2)}L` : "unknown"}
                        </span>
                      </li>
                    );
                  })}
                  <li className="pt-1"><Note>Model estimate, holding everything else fixed. Small or negative values mean the skill isn’t a strong pay signal for this profile.</Note></li>
                </ul>
              ) : <p className="text-sm text-ink-3">Add skills to see their effect.</p>}
            </Card>
          </div>

          <Card title="Real listings like this" sub={p ? `${fmtInt(p.comparables.count)} disclosed-salary listings in the same role family with similar experience` : ""}>
            {!p ? <Skeleton h={160} /> : p.comparables.examples.length ? (
              <ul className="divide-y divide-line">
                {p.comparables.examples.map((e) => (
                  <li key={e.jobId}>
                    <button onClick={() => setJob(e.jobId)} className="flex w-full items-center gap-3 py-2 text-left text-[13px] hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-ink">{e.title}</div>
                        <div className="truncate text-[12px] text-ink-3">{e.company} · {e.city} · {e.experience}</div>
                      </div>
                      <span className="num text-ink-2">{fmtLPA(e.salary)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-3">No close matches in the data.</p>}
          </Card>

          {card && (
            <Card title={<span className="inline-flex items-center gap-2"><Brain size={16} className="text-accent" />Model card</span>} sub={card.algorithm}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Typical error" value={fmtPct(card.metrics.medianAbsPctError)} hint={`vs ${fmtPct(card.metrics.baselineMedianAbsPctError)} for a flat median guess`} />
                  <Metric label="Within ±25%" value={fmtPct(card.metrics.within25Pct)} hint="of test listings" />
                  <Metric label="R² (log salary)" value={card.metrics.r2Log.toFixed(2)} hint="held-out 20%" />
                  <Metric label="P10–P90 coverage" value={fmtPct(card.metrics.intervalCoverage)} hint="target 80%" />
                </div>
                <div>
                  <div className="label">What drives the prediction</div>
                  <HBars items={Object.entries(card.featureImportance).map(([k, v]) => ({ label: k, value: v }))} format={(n) => fmtPct(n)} />
                  <p className="mt-2 text-[11.5px] text-ink-3">Grouped permutation importance on the test set.</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                Trained on {fmtInt(card.trainedOn)} listings, tested on {fmtInt(card.testedOn)}. Listings that disclose pay skew towards
                sales, support and smaller employers, so treat estimates for large IT firms and senior tech roles as conservative.
              </div>
            </Card>
          )}
        </div>
      </div>
      <JobDrawer id={job} onClose={() => setJob(null)} />
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-[18px] font-semibold text-ink">{value}</div>
      <div className="text-[11px] text-ink-3">{hint}</div>
    </div>
  );
}

function RangeStrip({ p10, p50, p90, cmp }: { p10: number; p50: number; p90: number; cmp: Prediction["comparables"] }) {
  const max = Math.max(p90, cmp.p75 ?? 0) * 1.15;
  const x = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="mt-6 space-y-4">
      <Row label="Model estimate">
        <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full" style={{ left: x(p10), width: `calc(${x(p90)} - ${x(p10)})`, background: "color-mix(in oklab, var(--accent) 35%, var(--surface))" }} />
        <div className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-[var(--surface)]" style={{ left: x(p50) }} />
      </Row>
      {cmp.p25 != null && cmp.p75 != null && cmp.median != null && (
        <Row label={`Similar listings (n=${cmp.count})`}>
          <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full" style={{ left: x(cmp.p25), width: `calc(${x(cmp.p75)} - ${x(cmp.p25)})`, background: "color-mix(in oklab, var(--ink-3) 35%, var(--surface))" }} />
          <div className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-3 ring-2 ring-[var(--surface)]" style={{ left: x(cmp.median) }} />
        </Row>
      )}
      <div className="grid grid-cols-[150px_1fr] text-[11px] text-ink-3">
        <span />
        <div className="relative h-3">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t} className={`num absolute whitespace-nowrap ${t === 1 ? "-translate-x-full" : t === 0 ? "" : "-translate-x-1/2"}`} style={{ left: `${t * 100}%` }}>{fmtLPA(max * t, max < 2e6 ? 1 : 0)}</span>
          ))}
        </div>
      </div>
      <p className="text-[11.5px] text-ink-3">Model band = P10–P90 · similar listings band = P25–P75 of actual salaries.</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--line)]" />
        {children}
      </div>
    </div>
  );
}
