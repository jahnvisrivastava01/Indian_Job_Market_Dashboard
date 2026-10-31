import clsx from "clsx";
import { Check, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { compact, titleCase } from "../lib/format";

/** Toggleable pill group for short option lists. */
export function PillGroup({
  options, value, onChange,
}: { options: { name: string; count?: number }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.name);
        return (
          <button
            key={o.name}
            onClick={() => onChange(on ? value.filter((v) => v !== o.name) : [...value, o.name])}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2 hover:border-ink-3",
            )}
          >
            {on && <Check size={12} className="text-accent" />}
            {o.name}
            {o.count != null && <span className="num text-[10.5px] text-ink-3">{compact(o.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Searchable checklist for long option lists (cities). */
export function SearchList({
  options, value, onChange, placeholder = "Search…", height = 200,
}: {
  options: { name: string; count?: number }[]; value: string[]; onChange: (v: string[]) => void;
  placeholder?: string; height?: number;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const ql = q.toLowerCase();
    const sel = options.filter((o) => value.includes(o.name));
    const rest = options.filter((o) => !value.includes(o.name) && o.name.toLowerCase().includes(ql));
    return [...sel, ...rest];
  }, [q, options, value]);
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-2.5">
        <Search size={14} className="text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          className="w-full bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-3" />
      </div>
      <ul className="overflow-y-auto py-1" style={{ maxHeight: height }}>
        {shown.map((o) => {
          const on = value.includes(o.name);
          return (
            <li key={o.name}>
              <button
                onClick={() => onChange(on ? value.filter((v) => v !== o.name) : [...value, o.name])}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className={clsx("flex h-4 w-4 items-center justify-center rounded border",
                  on ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate text-ink-2">{o.name}</span>
                {o.count != null && <span className="num text-[11px] text-ink-3">{compact(o.count)}</span>}
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="px-3 py-2 text-sm text-ink-3">No matches</li>}
      </ul>
    </div>
  );
}

/** Tag input with autocomplete against a known vocabulary (skills). */
export function TagInput({
  value, onChange, vocabulary, placeholder = "Add a skill…", allowFree = true, max = 25,
}: {
  value: string[]; onChange: (v: string[]) => void; vocabulary: { name: string; count?: number }[];
  placeholder?: string; allowFree?: boolean; max?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const sugg = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return vocabulary.filter((v) => !value.includes(v.name)).slice(0, 8);
    const starts = vocabulary.filter((v) => v.name.startsWith(ql) && !value.includes(v.name));
    const has = vocabulary.filter((v) => !v.name.startsWith(ql) && v.name.includes(ql) && !value.includes(v.name));
    return [...starts, ...has].slice(0, 8);
  }, [q, vocabulary, value]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = (s: string) => {
    const k = s.trim().toLowerCase();
    if (!k || value.includes(k) || value.length >= max) return;
    onChange([...value, k]);
    setQ("");
  };

  return (
    <div ref={box} className="relative">
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-accent">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-ink">
            {titleCase(v)}
            <button onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="text-ink-3 hover:text-ink">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (sugg[hi]) add(sugg[hi].name);
              else if (allowFree) add(q);
            } else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      {open && (sugg.length > 0 || (allowFree && q.trim())) && (
        <ul className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-xl">
          {sugg.map((s, i) => (
            <li key={s.name}>
              <button
                onMouseDown={(e) => { e.preventDefault(); add(s.name); }}
                onMouseEnter={() => setHi(i)}
                className={clsx("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm", i === hi ? "bg-surface-2 text-ink" : "text-ink-2")}
              >
                <span>{titleCase(s.name)}</span>
                {s.count != null && <span className="num text-[11px] text-ink-3">{compact(s.count)} jobs</span>}
              </button>
            </li>
          ))}
          {allowFree && q.trim() && !sugg.some((s) => s.name === q.trim().toLowerCase()) && (
            <li>
              <button onMouseDown={(e) => { e.preventDefault(); add(q); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-3 hover:bg-surface-2">
                <Plus size={13} /> Add “{q.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function Select({
  value, onChange, options, className,
}: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx("input appearance-none pr-8", className)}
      style={{ backgroundImage: "linear-gradient(45deg, transparent 50%, var(--ink-3) 50%), linear-gradient(135deg, var(--ink-3) 50%, transparent 50%)", backgroundPosition: "calc(100% - 16px) 55%, calc(100% - 11px) 55%", backgroundSize: "5px 5px", backgroundRepeat: "no-repeat" }}>
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
