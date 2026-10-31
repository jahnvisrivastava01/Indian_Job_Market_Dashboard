import { Building2, Clock, MapPin, Star, X } from "lucide-react";
import { useEffect } from "react";
import { useJob } from "../hooks/queries";
import { fmtInt, fmtLPA, titleCase } from "../lib/format";
import { MODE_COLOR } from "./charts";

export function JobDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: j, isLoading } = useJob(id);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (id == null) return null;

  const vsPeer = j?.salary && j.peerMedian ? j.salary / j.peerMedian - 1 : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            {isLoading || !j ? <div className="skeleton h-6 w-64" /> : (
              <>
                <h2 className="text-lg font-semibold leading-snug text-ink">{j.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1"><Building2 size={14} />{j.company}</span>
                  {j.rating != null && (
                    <span className="inline-flex items-center gap-1"><Star size={13} className="fill-current text-[var(--warn)]" />
                      <span className="num">{j.rating.toFixed(1)}</span>
                      {j.reviews != null && <span className="text-ink-3">({fmtInt(j.reviews)} reviews)</span>}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="btn px-2" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {j && (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Salary" value={j.salary ? `${fmtLPA(j.salaryMin)} – ${fmtLPA(j.salaryMax)}` : "Not disclosed"} />
              <Fact label="Experience" value={j.experience} />
              <Fact label="Work mode" value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[j.workMode] }} />{j.workMode}
                </span>} />
              <Fact label="Role family" value={j.roleCategory} />
              <Fact label="Seniority" value={j.seniority} />
              <Fact label="Posted" value={<span className="inline-flex items-center gap-1"><Clock size={13} />{j.posted}</span>} />
            </div>

            {j.salary && j.peerMedian && (
              <div className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
                This listing’s midpoint (<span className="num text-ink">{fmtLPA(j.salary)}</span>) is{" "}
                <b className="num text-ink">{Math.abs((vsPeer ?? 0) * 100).toFixed(0)}% {vsPeer! >= 0 ? "above" : "below"}</b>{" "}
                the median for {j.roleCategory} roles at similar experience ({fmtLPA(j.peerMedian)}, n={fmtInt(j.peerCount)}).
              </div>
            )}

            <div>
              <div className="label">Location</div>
              <div className="flex flex-wrap gap-1.5">
                {j.cities.length ? j.cities.map((c) => <span key={c} className="chip"><MapPin size={11} />{c}</span>) : <span className="text-sm text-ink-3">{j.location || "—"}</span>}
              </div>
            </div>

            <div>
              <div className="label">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {j.skills.map((s) => <span key={s} className="chip">{titleCase(s)}</span>)}
                {!j.skills.length && <span className="text-sm text-ink-3">None listed</span>}
              </div>
            </div>

            <div>
              <div className="label">Description</div>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{j.description || "—"}</p>
            </div>
            <div className="num text-[11px] text-ink-3">Job ID {j.jobId}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-ink">{value}</div>
    </div>
  );
}
