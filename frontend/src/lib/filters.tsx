import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { EMPTY_FILTERS, type Filters } from "./api";

type Ctx = {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  reset: () => void;
  activeCount: number;
};

const FilterCtx = createContext<Ctx | null>(null);
const LIST_KEYS = ["cities", "roles", "exp", "modes", "seniority", "skills"] as const;

/** Global filters live in the URL so every view is shareable / bookmarkable. */
export function FilterProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const f: Filters = { ...EMPTY_FILTERS };
    LIST_KEYS.forEach((k) => {
      const v = params.get(k);
      f[k] = v ? v.split("|").filter(Boolean) : [];
    });
    f.disclosed = params.get("disclosed") === "true";
    f.minRating = Number(params.get("minRating") || 0);
    return f;
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const merged = { ...filters, ...patch };
          LIST_KEYS.forEach((k) => (merged[k].length ? next.set(k, merged[k].join("|")) : next.delete(k)));
          merged.disclosed ? next.set("disclosed", "true") : next.delete("disclosed");
          merged.minRating > 0 ? next.set("minRating", String(merged.minRating)) : next.delete("minRating");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [filters, setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        [...LIST_KEYS, "disclosed", "minRating", "page"].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const activeCount =
    LIST_KEYS.reduce((a, k) => a + filters[k].length, 0) + (filters.disclosed ? 1 : 0) + (filters.minRating ? 1 : 0);

  return <FilterCtx.Provider value={{ filters, setFilters, reset, activeCount }}>{children}</FilterCtx.Provider>;
}

export function useFilters() {
  const c = useContext(FilterCtx);
  if (!c) throw new Error("useFilters outside provider");
  return c;
}
