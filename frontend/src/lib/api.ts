const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type Filters = {
  cities: string[];
  roles: string[];
  exp: string[];
  modes: string[];
  seniority: string[];
  skills: string[];
  disclosed: boolean;
  minRating: number;
};

export const EMPTY_FILTERS: Filters = {
  cities: [], roles: [], exp: [], modes: [], seniority: [], skills: [], disclosed: false, minRating: 0,
};

export function filtersToQuery(f: Filters, extra: Record<string, string | number | undefined> = {}) {
  const p = new URLSearchParams();
  (["cities", "roles", "exp", "modes", "seniority", "skills"] as const).forEach((k) => {
    if (f[k].length) p.set(k, f[k].join("|"));
  });
  if (f.disclosed) p.set("disclosed", "true");
  if (f.minRating > 0) p.set("minRating", String(f.minRating));
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function apiUrl(path: string) {
  return `${BASE}/api${path}`;
}

export async function get<T>(path: string): Promise<T> {
  const r = await fetch(apiUrl(path));
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

/* ---------------- response types ---------------- */
export type NameCount = { name: string; count: number };

export type Meta = {
  totalListings: number;
  cities: NameCount[];
  roles: NameCount[];
  expBands: string[];
  modes: NameCount[];
  seniority: string[];
  skills: NameCount[];
  predictor: { roles: string[]; seniority: string[]; cities: string[]; modes: string[]; skills: string[] };
};

export type Overview = {
  empty: boolean;
  kpis: {
    listings: number; companies: number; cities: number; medianSalary: number | null;
    disclosedPct: number; flexiblePct: number; avgRating: number | null; medianExp: number | null;
  };
  roles: (NameCount & { medianSalary: number | null })[];
  cities: NameCount[];
  salaryBands: { band: string; count: number }[];
  experience: { band: string; count: number }[];
  workMode: NameCount[];
  recency: { day: number; count: number }[];
  topTitles: NameCount[];
  topSkills: NameCount[];
  insights: string[];
};

export type Quartile = { name: string; n: number; p25: number; p50: number; p75: number };

export type Market = {
  empty: boolean;
  heatmap: { cities: string[]; roles: string[]; values: number[][]; rowShare: number[][] };
  companies: {
    name: string; listings: number; rating: number | null; reviews: number | null;
    medianSalary: number | null; topRole: string; cities: number;
  }[];
  ratingDist: { band: string; count: number }[];
  seniority: NameCount[];
  topTitles: NameCount[];
  workModeByRole: ({ name: string } & Record<string, number | string>)[];
  companyConcentration: number;
};

export type Salary = {
  empty: boolean;
  disclosed: number;
  total: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  mean: number;
  histogram: { lpa: number; count: number }[];
  bands: { band: string; count: number }[];
  byExperience: Quartile[];
  byCity: Quartile[];
  byRole: Quartile[];
  bySeniority: Quartile[];
  byMode: Quartile[];
  topPaying: { title: string; company: string; salary: number; jobId: number; city: string }[];
};

export type Skills = {
  empty: boolean;
  listings: number;
  baselineMedian: number | null;
  uniqueSkills: number;
  avgSkillsPerListing: number;
  top: { name: string; count: number; share: number; medianSalary: number | null }[];
  premium: { name: string; medianSalary: number; premium: number; count: number; disclosed: number }[];
  premiumMinSample: number;
  pairs: { a: string; b: string; count: number }[];
};

export type SkillDetail = {
  name: string;
  empty: boolean;
  count: number;
  share: number;
  medianSalary: number | null;
  medianWithout: number | null;
  disclosed: number;
  medianExp: number | null;
  related: { name: string; count: number; share: number; lift: number | null }[];
  cities: NameCount[];
  roles: NameCount[];
  companies: NameCount[];
  byExperience: Quartile[];
  workMode: NameCount[];
};

export type Gap = {
  role: string;
  poolSize: number;
  scopedToCity: boolean;
  coverage: number;
  matchingJobs: number;
  anyOverlapJobs: number;
  demand: { name: string; share: number; count: number; have: boolean; premium: number | null }[];
  recommend: { name: string; share: number; count: number; premium: number | null }[];
  unknown: string[];
};

export type ModelCard = {
  trainedOn: number;
  testedOn: number;
  target: string;
  algorithm: string;
  metrics: {
    r2Log: number; medianAbsPctError: number; baselineMedianAbsPctError: number;
    within25Pct: number; intervalCoverage: number; maeINR: number;
  };
  featureImportance: Record<string, number>;
  skillsUsed: number;
  citiesUsed: number;
};

export type Prediction = {
  p10: number; p50: number; p90: number;
  skillImpact: { skill: string; delta: number; known: boolean }[];
  comparables: {
    count: number; median: number | null; p25: number | null; p75: number | null;
    examples: { jobId: number; title: string; company: string; salary: number; city: string; experience: string }[];
  };
  curve: { exp: number; p10: number; p50: number; p90: number }[];
};

export type JobSummary = {
  jobId: number; title: string; company: string; rating: number | null; cities: string[];
  workMode: string; roleCategory: string; salary: number | null; salaryText: string;
  experience: string; posted: string; skills: string[];
};

export type JobsPage = { total: number; page: number; pageSize: number; items: JobSummary[] };

export type JobDetail = JobSummary & {
  titleRaw: string; reviews: number | null; salaryMin: number | null; salaryMax: number | null;
  location: string; seniority: string; description: string; peerMedian: number | null; peerCount: number;
};
