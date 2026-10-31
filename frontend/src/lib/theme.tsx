import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
export type Accent = "saffron" | "blue" | "emerald" | "rose";
export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "saffron", label: "Saffron", swatch: "#c2410c" },
  { id: "blue", label: "Blue", swatch: "#2a6fd6" },
  { id: "emerald", label: "Emerald", swatch: "#0f8a62" },
  { id: "rose", label: "Rose", swatch: "#c42a63" },
];

type Ctx = { theme: Theme; accent: Accent; toggle: () => void; setAccent: (a: Accent) => void; version: number };
const ThemeCtx = createContext<Ctx | null>(null);

const safeGet = (k: string) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || (safeGet("ijm-theme") as Theme) || "light",
  );
  const [accent, setAccentState] = useState<Accent>(
    () => (document.documentElement.dataset.accent as Accent) || "saffron",
  );
  // bump so charts re-read CSS variables after a change
  const [version, setVersion] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    safeSet("ijm-theme", theme);
    safeSet("ijm-accent", accent);
    requestAnimationFrame(() => setVersion((v) => v + 1));
  }, [theme, accent]);

  return (
    <ThemeCtx.Provider
      value={{ theme, accent, version, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")), setAccent: setAccentState }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme outside provider");
  return c;
}

/** Resolved CSS colours for SVG charts (Recharts needs real values for some props). */
export function useChartColors() {
  const { version } = useTheme();
  const [c, setC] = useState(() => read());
  useEffect(() => setC(read()), [version]);
  return c;
}

function read() {
  const s = getComputedStyle(document.documentElement);
  const v = (k: string) => s.getPropertyValue(k).trim();
  return {
    accent: v("--accent"),
    ink: v("--ink"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    grid: v("--grid"),
    line: v("--line"),
    surface: v("--surface"),
    surface2: v("--surface-2"),
    s1: v("--series-1"),
    s2: v("--series-2"),
    s3: v("--series-3"),
  };
}
