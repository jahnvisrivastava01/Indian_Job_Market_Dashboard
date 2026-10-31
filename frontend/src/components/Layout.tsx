import clsx from "clsx";
import {
  BarChart3, Briefcase, Building2, Calculator, Github, IndianRupee, Menu, Moon, Sparkles, SlidersHorizontal, Sun, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMeta } from "../hooks/queries";
import { useFilters } from "../lib/filters";
import { titleCase } from "../lib/format";
import { ACCENTS, useTheme } from "../lib/theme";
import { PillGroup, SearchList, TagInput } from "./inputs";

const NAV = [
  { to: "/", label: "Overview", icon: BarChart3 },
  { to: "/market", label: "Job Market", icon: Building2 },
  { to: "/salary", label: "Salaries", icon: IndianRupee },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/predict", label: "Salary Predictor", icon: Calculator },
  { to: "/jobs", label: "Job Explorer", icon: Briefcase },
];

export function Layout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setNavOpen(false), [loc.pathname]);
  const showFilters = loc.pathname !== "/predict";

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-[232px] border-r border-line bg-surface transition-transform lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
              <BarChart3 size={17} strokeWidth={2.4} />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold text-ink">Job Market</div>
              <div className="text-[11.5px] text-ink-3">India · 2025 listings</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={{ pathname: to, search: loc.search }}
                end={to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors",
                    isActive ? "bg-accent-soft font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? "text-accent" : "text-ink-3"} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-3 border-t border-line px-5 py-4 text-[11.5px] leading-relaxed text-ink-3">
            <div>~98K Naukri listings · Sep–Oct 2025</div>
            <a href="https://github.com/jahnvisrivastava01/Indian_Job_Market_Dashboard" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
              <Github size={13} /> Source on GitHub
            </a>
            <div>Built by Jahnvi Srivastava</div>
          </div>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <button className="btn px-2 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <Menu size={16} />
            </button>
            <div className="flex-1" />
            {showFilters && <FilterButton onClick={() => setFiltersOpen(true)} />}
            <ThemeControls />
          </div>
          {showFilters && <ActiveChips />}
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      {filtersOpen && <FilterDrawer onClose={() => setFiltersOpen(false)} />}
    </div>
  );
}

function FilterButton({ onClick }: { onClick: () => void }) {
  const { activeCount } = useFilters();
  return (
    <button className="btn" onClick={onClick}>
      <SlidersHorizontal size={15} />
      <span className="hidden sm:inline">Filters</span>
      {activeCount > 0 && (
        <span className="num rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">{activeCount}</span>
      )}
    </button>
  );
}

function ThemeControls() {
  const { theme, toggle, accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-2">
      <button className="btn px-2.5" onClick={() => setOpen((o) => !o)} aria-label="Accent colour" title="Accent colour">
        <span className="h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-[var(--surface)] ring-offset-1 ring-offset-[var(--line)]" />
      </button>
      {open && (
        <div className="absolute right-11 top-11 z-50 w-44 rounded-xl border border-line bg-surface p-2 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-ink-3">Accent</div>
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => { setAccent(a.id); setOpen(false); }}
              className={clsx("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2",
                accent === a.id ? "text-ink font-medium" : "text-ink-2")}>
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: a.swatch }} />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button className="btn px-2.5" onClick={toggle} aria-label="Toggle theme" title={theme === "dark" ? "Light mode" : "Dark mode"}>
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}

function ActiveChips() {
  const { filters, setFilters, reset, activeCount } = useFilters();
  if (!activeCount) return null;
  const chips: { label: string; remove: () => void }[] = [];
  (["cities", "roles", "exp", "modes", "seniority", "skills"] as const).forEach((k) =>
    filters[k].forEach((v) =>
      chips.push({
        label: k === "skills" ? titleCase(v) : v,
        remove: () => setFilters({ [k]: filters[k].filter((x) => x !== v) }),
      }),
    ),
  );
  if (filters.disclosed) chips.push({ label: "Salary disclosed", remove: () => setFilters({ disclosed: false }) });
  if (filters.minRating) chips.push({ label: `Rating ≥ ${filters.minRating}`, remove: () => setFilters({ minRating: 0 }) });
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5 sm:px-6">
      {chips.map((c) => (
        <span key={c.label} className="chip">
          {c.label}
          <button onClick={c.remove} aria-label={`Remove ${c.label}`} className="text-ink-3 hover:text-ink"><X size={12} /></button>
        </span>
      ))}
      <button onClick={reset} className="ml-1 text-xs font-medium text-accent hover:underline">Clear all</button>
    </div>
  );
}

function FilterDrawer({ onClose }: { onClose: () => void }) {
  const { data: meta } = useMeta();
  const { filters, setFilters, reset, activeCount } = useFilters();
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[400px] flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="font-semibold text-ink">Filters</div>
            <div className="text-xs text-ink-3">Applied to every page · saved in the URL</div>
          </div>
          <button className="btn px-2" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {!meta ? (
          <div className="p-5"><div className="skeleton h-40" /></div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <section>
              <label className="label">City</label>
              <SearchList options={meta.cities} value={filters.cities} onChange={(v) => setFilters({ cities: v })} placeholder="Search cities…" />
            </section>
            <section>
              <label className="label">Role family</label>
              <PillGroup options={meta.roles} value={filters.roles} onChange={(v) => setFilters({ roles: v })} />
            </section>
            <section>
              <label className="label">Experience</label>
              <PillGroup options={meta.expBands.map((n) => ({ name: n }))} value={filters.exp} onChange={(v) => setFilters({ exp: v })} />
            </section>
            <section>
              <label className="label">Seniority (from title)</label>
              <PillGroup options={meta.seniority.map((n) => ({ name: n }))} value={filters.seniority} onChange={(v) => setFilters({ seniority: v })} />
            </section>
            <section>
              <label className="label">Work mode</label>
              <PillGroup options={meta.modes} value={filters.modes} onChange={(v) => setFilters({ modes: v })} />
            </section>
            <section>
              <label className="label">Must include skills</label>
              <TagInput value={filters.skills} onChange={(v) => setFilters({ skills: v })} vocabulary={meta.skills} allowFree={false} />
            </section>
            <section>
              <label className="label">Company rating ≥ <span className="num normal-case text-ink">{filters.minRating || "any"}</span></label>
              <input type="range" min={0} max={4.5} step={0.5} value={filters.minRating}
                onChange={(e) => setFilters({ minRating: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
            </section>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <span className="text-sm text-ink-2">Only listings with a disclosed salary</span>
              <input type="checkbox" checked={filters.disclosed} onChange={(e) => setFilters({ disclosed: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]" />
            </label>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <button className="text-sm text-ink-3 hover:text-ink disabled:opacity-40" disabled={!activeCount} onClick={reset}>Reset</button>
          <button className="btn-accent" onClick={onClose}>
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}

