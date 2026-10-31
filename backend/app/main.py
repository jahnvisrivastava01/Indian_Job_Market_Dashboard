"""
Indian Job Market Intelligence — FastAPI backend.

    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import io
import os
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import EXP_ORDER, SALARY_BANDS, SENIORITY_ORDER, Filters, Store, med, py
from .ml import load_model

app = FastAPI(title="Indian Job Market Intelligence API", version="2.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

store: Store | None = None
model = None


@app.on_event("startup")
def _startup() -> None:
    global store, model
    store = Store()
    model = load_model(store.df)
    _release_memory()
    print(f"[api] ready: {store.n:,} listings")


def _release_memory() -> None:
    """Hand freed load-time buffers back to the OS (~100 MB on Linux)."""
    import ctypes
    import gc

    import pyarrow as pa

    gc.collect()
    pa.default_memory_pool().release_unused()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except OSError:
        pass


def get_filters(
    cities: str = "", roles: str = "", exp: str = "", modes: str = "", seniority: str = "",
    skills: str = "", disclosed: bool = False, minRating: float = 0.0,
) -> Filters:
    return Filters.parse(cities, roles, exp, modes, seniority, skills, disclosed, minRating)


def counts(series: pd.Series, top: int | None = None, name="name") -> list[dict]:
    vc = series.value_counts()
    if top:
        vc = vc.head(top)
    return [{name: k, "count": int(v)} for k, v in vc.items()]


# --------------------------------------------------------------------------- #
# Meta
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    return {"ok": store is not None, "rows": store.n if store else 0}


@app.get("/api/meta")
def meta():
    return _meta()


@lru_cache(maxsize=1)
def _meta():
    df = store.df
    return {
        "totalListings": store.n,
        "cities": [{"name": c, "count": int(n)} for c, n in store.city_counts.head(80).items()],
        "roles": counts(df["roleCategory"]),
        "expBands": [b for b in EXP_ORDER if b in set(df["expBand"])],
        "modes": counts(df["workMode"]),
        "seniority": [s for s in SENIORITY_ORDER if s in set(df["seniority"])],
        "skills": [{"name": s, "count": int(n)} for s, n in store.skill_counts.head(1500).items()],
        "predictor": {
            "roles": model.categories["roleCategory"],
            "seniority": [s for s in SENIORITY_ORDER if s in model.categories["seniority"]],
            "cities": model.categories["city"],
            "modes": model.categories["workMode"],
            "skills": model.skills,
        },
    }


# --------------------------------------------------------------------------- #
# Overview
# --------------------------------------------------------------------------- #
def salary_bands(sal: pd.Series) -> list[dict]:
    s = sal.dropna()
    return [{"band": lbl, "count": int(((s >= lo) & (s < hi)).sum())} for lo, hi, lbl in SALARY_BANDS]


@lru_cache(maxsize=256)
def _overview(f: Filters):
    d = store.subset(f)
    n = len(d)
    if n == 0:
        return {"empty": True}
    cx = store.city_rows[store.city_rows["row"].isin(d.index)]
    disclosed = d["salary"].notna()
    role_stats = (
        d.groupby("roleCategory")
        .agg(count=("jobId", "size"), median=("salary", "median"), disclosed=("salary", "count"))
        .sort_values("count", ascending=False)
        .reset_index()
    )
    roles = [
        {"name": r.roleCategory, "count": int(r.count), "medianSalary": py(r.median) if r.disclosed >= 15 else None}
        for r in role_stats.itertuples()
    ]
    exp = d["expBand"].value_counts()
    recency = d["postedDaysAgo"].dropna().astype(int).clip(upper=30).value_counts().sort_index()
    top_city = cx["city"].value_counts()
    top_skill = store.skill_rows[store.skill_rows["row"].isin(d.index)]["skill"].value_counts()

    insights = []
    if len(top_city):
        c0, c0n = top_city.index[0], int(top_city.iloc[0])
        insights.append(f"{c0} leads with {c0n:,} listings — {c0n / n:.0%} of the current selection.")
    if len(roles):
        insights.append(f"{roles[0]['name']} is the largest role family ({roles[0]['count'] / n:.0%} of listings).")
    paid = [r for r in roles if r["medianSalary"] and r["count"] >= 50]
    if paid:
        best = max(paid, key=lambda r: r["medianSalary"])
        insights.append(f"{best['name']} has the highest median disclosed pay at ₹{best['medianSalary'] / 1e5:.1f} LPA.")
    insights.append(f"Only {disclosed.mean():.0%} of listings disclose a salary — "
                    "salary figures below are based on that subset.")
    if len(top_skill):
        insights.append(f"Most requested skill: {top_skill.index[0]} ({int(top_skill.iloc[0]):,} listings).")

    return {
        "empty": False,
        "kpis": {
            "listings": n,
            "companies": int(d["company"].nunique()),
            "cities": int(cx["city"].nunique()),
            "medianSalary": med(d["salary"]),
            "disclosedPct": py(disclosed.mean()),
            "flexiblePct": py(d["workMode"].ne("On-site").mean()),
            "avgRating": py(d["rating"].mean()),
            "medianExp": med(d["expAvg"]),
        },
        "roles": roles,
        "cities": [{"name": k, "count": int(v)} for k, v in top_city.head(12).items()],
        "salaryBands": salary_bands(d["salary"]),
        "experience": [{"band": b, "count": int(exp.get(b, 0))} for b in EXP_ORDER if b != "Not stated"],
        "workMode": counts(d["workMode"]),
        "recency": [{"day": int(k), "count": int(v)} for k, v in recency.items()],
        "topTitles": counts(d["titleClean"], 10),
        "topSkills": [{"name": k, "count": int(v)} for k, v in top_skill.head(10).items()],
        "insights": insights,
    }


@app.get("/api/overview")
def overview(f: Filters = Depends(get_filters)):
    return _overview(f)


# --------------------------------------------------------------------------- #
# Market
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=256)
def _market(f: Filters):
    d = store.subset(f)
    if len(d) == 0:
        return {"empty": True}
    cx = store.city_rows[store.city_rows["row"].isin(d.index)].merge(
        d[["roleCategory"]], left_on="row", right_index=True
    )
    top_cities = cx["city"].value_counts().head(10).index.tolist()
    top_roles = d["roleCategory"].value_counts().head(10).index.tolist()
    ct = pd.crosstab(cx["city"], cx["roleCategory"]).reindex(index=top_cities, columns=top_roles, fill_value=0)
    heat = {
        "cities": top_cities,
        "roles": top_roles,
        "values": ct.to_numpy().astype(int).tolist(),
        "rowShare": (ct.div(ct.sum(axis=1).replace(0, 1), axis=0)).round(4).to_numpy().tolist(),
    }

    top_names = d["company"].value_counts().head(30).index
    dc = d[d["company"].isin(top_names)]
    comp = (
        dc.groupby("company")
        .agg(
            listings=("jobId", "size"),
            rating=("rating", "max"),
            reviews=("reviews", "max"),
            median=("salary", "median"),
            disclosed=("salary", "count"),
            topRole=("roleCategory", lambda s: s.value_counts().index[0]),
            cities=("primaryCity", "nunique"),
        )
        .sort_values("listings", ascending=False)
        .reset_index()
    )
    companies = [
        {
            "name": r.company, "listings": int(r.listings), "rating": py(r.rating), "reviews": py(r.reviews),
            "medianSalary": py(r.median) if r.disclosed >= 5 else None, "topRole": r.topRole,
            "cities": int(r.cities),
        }
        for r in comp.itertuples()
    ]
    rated = d.dropna(subset=["rating"]).drop_duplicates("company")
    rating_bins = pd.cut(rated["rating"], bins=[0, 3, 3.5, 4, 4.5, 5.01],
                         labels=["< 3.0", "3.0–3.5", "3.5–4.0", "4.0–4.5", "4.5+"], right=False)
    sen = d["seniority"].value_counts()
    return {
        "empty": False,
        "heatmap": heat,
        "companies": companies,
        "ratingDist": [{"band": str(k), "count": int(v)} for k, v in rating_bins.value_counts().sort_index().items()],
        "seniority": [{"name": s, "count": int(sen.get(s, 0))} for s in SENIORITY_ORDER],
        "topTitles": counts(d["titleClean"], 20),
        "workModeByRole": [
            {"name": role, **{m: int(v) for m, v in g["workMode"].value_counts().items()}}
            for role, g in d[d["roleCategory"].isin(top_roles)].groupby("roleCategory")
        ],
        "companyConcentration": py(comp["listings"].head(10).sum() / len(d)),
    }


@app.get("/api/market")
def market(f: Filters = Depends(get_filters)):
    return _market(f)


# --------------------------------------------------------------------------- #
# Salary
# --------------------------------------------------------------------------- #
def quartiles(g: pd.DataFrame, key: str, min_n: int = 25, order: list[str] | None = None, top: int | None = None):
    agg = g.groupby(key)["salary"].agg(
        n="count", p25=lambda s: s.quantile(0.25), p50="median", p75=lambda s: s.quantile(0.75)
    )
    agg = agg[agg["n"] >= min_n]
    if order:
        agg = agg.reindex([o for o in order if o in agg.index])
    else:
        agg = agg.sort_values("p50", ascending=False)
    if top:
        agg = agg.head(top)
    return [{"name": k, "n": int(r.n), "p25": py(r.p25), "p50": py(r.p50), "p75": py(r.p75)} for k, r in agg.iterrows()]


@lru_cache(maxsize=256)
def _salary(f: Filters):
    d = store.subset(f)
    s = d[d["salary"].notna()]
    if len(s) < 5:
        return {"empty": True, "disclosed": int(len(s))}
    sal = s["salary"]
    p = sal.quantile([0.1, 0.25, 0.5, 0.75, 0.9, 0.99])
    cap = p.loc[0.99]
    clipped = sal[sal <= cap] / 1e5
    counts_, edges = np.histogram(clipped, bins=40)
    cx = store.city_rows[store.city_rows["row"].isin(s.index)].merge(
        s[["salary"]], left_on="row", right_index=True
    )
    return {
        "empty": False,
        "disclosed": int(len(s)),
        "total": int(len(d)),
        "percentiles": {k: py(p.loc[q]) for k, q in
                        [("p10", 0.1), ("p25", 0.25), ("p50", 0.5), ("p75", 0.75), ("p90", 0.9)]},
        "mean": py(sal.mean()),
        "histogram": [{"lpa": round(float((edges[i] + edges[i + 1]) / 2), 1), "count": int(c)}
                      for i, c in enumerate(counts_)],
        "bands": salary_bands(sal),
        "byExperience": quartiles(s, "expBand", 10, [b for b in EXP_ORDER if b != "Not stated"]),
        "byCity": quartiles(cx.rename(columns={"city": "c"}), "c", 30, top=15),
        "byRole": quartiles(s, "roleCategory", 25),
        "bySeniority": quartiles(s, "seniority", 15, SENIORITY_ORDER),
        "byMode": quartiles(s, "workMode", 10),
        "topPaying": [
            {"title": r.titleClean, "company": r.company, "salary": py(r.salary), "jobId": int(r.jobId),
             "city": r.primaryCity}
            for r in s.nlargest(10, "salary").itertuples()
        ],
    }


@app.get("/api/salary")
def salary(f: Filters = Depends(get_filters)):
    return _salary(f)


# --------------------------------------------------------------------------- #
# Skills
# --------------------------------------------------------------------------- #
def _skill_table(d: pd.DataFrame) -> pd.DataFrame:
    sr = store.skill_rows[store.skill_rows["row"].isin(d.index)]
    sr = sr.assign(salary=store.salary[sr["row"].to_numpy()])
    t = sr.groupby("skill").agg(count=("row", "size"), disclosed=("salary", "count"), median=("salary", "median"))
    return t.sort_values("count", ascending=False)


def _salary_breadth(d: pd.DataFrame, skills) -> pd.DataFrame:
    """Per skill: how many distinct companies posted the disclosed salaries, and the
    largest single company's share — used to stop one recruiter's repeated posts
    from defining a skill's 'premium'."""
    sr = store.skill_rows[store.skill_rows["row"].isin(d.index) & store.skill_rows["skill"].isin(skills)]
    sr = sr[~np.isnan(store.salary[sr["row"].to_numpy()])]
    sr = sr.assign(company=store.df["company"].to_numpy()[sr["row"].to_numpy()])
    g = sr.groupby("skill")["company"]
    return pd.DataFrame({"companies": g.nunique(), "topShare": g.agg(lambda s: s.value_counts(normalize=True).iloc[0])})


@lru_cache(maxsize=256)
def _skills(f: Filters):
    d = store.subset(f)
    if len(d) == 0:
        return {"empty": True}
    t = _skill_table(d)
    base = d["salary"].median()
    n = len(d)
    top = [
        {"name": k, "count": int(r["count"]), "share": py(r["count"] / n),
         "medianSalary": py(r["median"]) if r["disclosed"] >= 20 else None}
        for k, r in t.head(30).iterrows()
    ]
    min_n = max(40, int(0.002 * d["salary"].notna().sum()))
    prem = t[(t["disclosed"] >= min_n)].copy()
    breadth = _salary_breadth(d, prem.index)
    prem = prem.join(breadth)
    prem = prem[(prem["companies"] >= 10) & (prem["topShare"] <= 0.3)]
    prem["premium"] = prem["median"] / base - 1 if pd.notna(base) and base > 0 else np.nan
    prem = prem.sort_values("median", ascending=False)
    premium = [
        {"name": k, "medianSalary": py(r["median"]), "premium": py(r["premium"]), "count": int(r["count"]),
         "disclosed": int(r["disclosed"])}
        for k, r in prem.head(20).iterrows()
    ]
    # Skills that co-occur most strongly (pair counts among top 40 skills)
    top40 = set(t.head(40).index)
    pair = Counter()
    for sk in d["skills"]:
        ks = sorted(set(sk) & top40)
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                pair[(ks[i], ks[j])] += 1
    pairs = [{"a": a, "b": b, "count": c} for (a, b), c in pair.most_common(15)]
    return {
        "empty": False,
        "listings": n,
        "baselineMedian": py(base),
        "uniqueSkills": int(len(t)),
        "avgSkillsPerListing": py(d["skills"].map(len).mean()),
        "top": top,
        "premium": premium,
        "premiumMinSample": min_n,
        "pairs": pairs,
    }


@app.get("/api/skills")
def skills(f: Filters = Depends(get_filters)):
    return _skills(f)


@app.get("/api/skills/search")
def skill_search(q: str = Query("", min_length=0), limit: int = 12):
    ql = q.strip().lower()
    if not ql:
        return [{"name": k, "count": int(v)} for k, v in store.skill_counts.head(limit).items()]
    sc = store.skill_counts
    starts = sc[sc.index.str.startswith(ql)]
    contains = sc[sc.index.str.contains(ql, regex=False) & ~sc.index.str.startswith(ql)]
    res = pd.concat([starts.head(limit), contains.head(limit)]).head(limit)
    return [{"name": k, "count": int(v)} for k, v in res.items()]


@lru_cache(maxsize=512)
def _skill_detail(name: str, f: Filters):
    name = name.lower()
    if name not in store.skill_index:
        raise HTTPException(404, f"Skill '{name}' not found")
    base_mask = store.mask(f)
    sm = np.zeros(store.n, dtype=bool)
    sm[store.skill_index[name]] = True
    m = base_mask & sm
    d = store.df[m]
    pool = int(base_mask.sum())
    if len(d) == 0:
        return {"name": name, "count": 0, "empty": True}
    without = store.df[base_mask & ~sm]
    co = store.skill_rows[store.skill_rows["row"].isin(d.index) & (store.skill_rows["skill"] != name)]["skill"]
    co_counts = co.value_counts().head(40)
    # lift = P(b | a) / P(b)
    pool_counts = store.skill_rows[store.skill_rows["row"].isin(np.flatnonzero(base_mask))]["skill"].value_counts()
    related = []
    for k, c in co_counts.items():
        pb = pool_counts.get(k, 0) / max(pool, 1)
        related.append({"name": k, "count": int(c), "share": py(c / len(d)),
                        "lift": py((c / len(d)) / pb) if pb else None})
    cx = store.city_rows[store.city_rows["row"].isin(d.index)]["city"].value_counts().head(8)
    s = d[d["salary"].notna()]
    return {
        "name": name,
        "empty": False,
        "count": int(len(d)),
        "share": py(len(d) / max(pool, 1)),
        "medianSalary": med(d["salary"]),
        "medianWithout": med(without["salary"]),
        "disclosed": int(len(s)),
        "medianExp": med(d["expAvg"]),
        "related": related[:15],
        "cities": [{"name": k, "count": int(v)} for k, v in cx.items()],
        "roles": counts(d["roleCategory"], 8),
        "companies": counts(d["company"], 8),
        "byExperience": quartiles(s, "expBand", 8, [b for b in EXP_ORDER if b != "Not stated"]) if len(s) else [],
        "workMode": counts(d["workMode"]),
    }


@app.get("/api/skills/{name}")
def skill_detail(name: str, f: Filters = Depends(get_filters)):
    return _skill_detail(name, f)


class GapRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    role: str
    city: str | None = None
    expBand: str | None = None


@app.post("/api/skills/gap")
def skill_gap(req: GapRequest):
    mine = {s.strip().lower() for s in req.skills if s.strip()}
    f = Filters(roles=(req.role,), cities=(req.city,) if req.city else (),
                exp=(req.expBand,) if req.expBand else ())
    d = store.subset(f)
    if len(d) < 20:
        f = Filters(roles=(req.role,))
        d = store.subset(f)
    if len(d) == 0:
        raise HTTPException(404, "No listings for that role")
    t = _skill_table(d).head(30)
    n = len(d)
    base = d["salary"].median()
    demand = []
    for k, r in t.iterrows():
        demand.append({
            "name": k, "share": py(r["count"] / n), "count": int(r["count"]), "have": k in mine,
            "premium": py(r["median"] / base - 1) if r["disclosed"] >= 15 and pd.notna(base) else None,
        })
    total_w = sum(x["share"] for x in demand) or 1
    coverage = sum(x["share"] for x in demand if x["have"]) / total_w
    overlap = d["skills"].map(lambda sk: len(mine & set(sk)))
    nsk = d["skills"].map(len).replace(0, 1)
    strong = int(((overlap >= 3) | ((overlap / nsk) >= 0.5)).sum())
    missing = sorted([x for x in demand if not x["have"]],
                     key=lambda x: -(x["share"] * (1 + max(x["premium"] or 0, 0))))
    return {
        "role": req.role,
        "poolSize": n,
        "scopedToCity": bool(req.city) and f.cities == (req.city,),
        "coverage": round(coverage, 3),
        "matchingJobs": strong,
        "anyOverlapJobs": int((overlap > 0).sum()),
        "demand": demand,
        "recommend": missing[:6],
        "unknown": sorted(s for s in mine if s not in store.skill_index),
    }


# --------------------------------------------------------------------------- #
# Predictor
# --------------------------------------------------------------------------- #
class PredictRequest(BaseModel):
    roleCategory: str
    seniority: str = "Not stated"
    city: str = "Other"
    workMode: str = "On-site"
    expMin: float = Field(ge=0, le=40)
    expMax: float = Field(ge=0, le=45)
    skills: list[str] = Field(default_factory=list)


@app.get("/api/model")
def model_card():
    return model.card


@app.post("/api/predict")
def predict(req: PredictRequest):
    base = req.model_dump()
    base["expMax"] = max(base["expMax"], base["expMin"])
    base["skills"] = [s.lower() for s in base["skills"]]
    rows = [base]
    for s in base["skills"]:
        rows.append({**base, "skills": [x for x in base["skills"] if x != s]})
    out = model.predict(rows)
    p50 = float(out["p50"][0])
    impact = sorted(
        [{"skill": s, "delta": round(p50 - float(out["p50"][i + 1]), 0),
          "known": s in model.skills} for i, s in enumerate(base["skills"])],
        key=lambda x: -x["delta"],
    )
    # Real comparables from the data
    exp_avg = (base["expMin"] + base["expMax"]) / 2
    df = store.df
    comp = df[(df["roleCategory"] == req.roleCategory) & df["salary"].notna()
              & (df["expAvg"].sub(exp_avg).abs() <= 1.5)]
    if req.city and req.city != "Other":
        cmask = np.zeros(store.n, dtype=bool)
        idx = store.city_index.get(req.city)
        if idx is not None:
            cmask[idx] = True
        comp_city = comp[cmask[comp.index]]
        if len(comp_city) >= 10:
            comp = comp_city
    # Experience curve for this profile
    curve_rows = [{**base, "expMin": max(e - 1, 0), "expMax": e + 1} for e in range(0, 21, 2)]
    curve = model.predict(curve_rows)
    return {
        "p10": round(float(out["p10"][0]), 0),
        "p50": round(p50, 0),
        "p90": round(float(out["p90"][0]), 0),
        "skillImpact": impact,
        "comparables": {
            "count": int(len(comp)),
            "median": med(comp["salary"]),
            "p25": py(comp["salary"].quantile(0.25)) if len(comp) else None,
            "p75": py(comp["salary"].quantile(0.75)) if len(comp) else None,
            "examples": [
                {"jobId": int(r.jobId), "title": r.titleClean, "company": r.company, "salary": py(r.salary),
                 "city": r.primaryCity, "experience": r.experienceText}
                for r in comp.sample(min(6, len(comp)), random_state=1).itertuples()
            ] if len(comp) else [],
        },
        "curve": [{"exp": e, "p10": round(float(curve["p10"][i])), "p50": round(float(curve["p50"][i])),
                   "p90": round(float(curve["p90"][i]))} for i, e in enumerate(range(0, 21, 2))],
    }


# --------------------------------------------------------------------------- #
# Jobs explorer
# --------------------------------------------------------------------------- #
SORTS = {
    "recent": ("postedDaysAgo", True),
    "salary": ("salary", False),
    "rating": ("rating", False),
    "experience": ("expAvg", True),
}


def _search_mask(d: pd.DataFrame, q: str) -> pd.Series:
    q = q.strip().lower()
    if not q:
        return pd.Series(True, index=d.index)
    hay = (d["title"].str.lower() + " " + d["company"].str.lower() + " "
           + d["skills"].map(lambda s: " ".join(s)))
    m = pd.Series(True, index=d.index)
    for term in q.split():
        m &= hay.str.contains(term, regex=False)
    return m


def _job_summary(r) -> dict:
    return {
        "jobId": int(r.jobId), "title": r.titleClean, "company": r.company, "rating": py(r.rating),
        "cities": list(r.cities)[:3], "workMode": r.workMode, "roleCategory": r.roleCategory,
        "salary": py(r.salary), "salaryText": r.salaryText, "experience": r.experienceText,
        "posted": r.postedText, "skills": list(r.skills)[:6],
    }


@app.get("/api/jobs")
def jobs(
    f: Filters = Depends(get_filters), q: str = "", sort: str = "recent",
    page: int = Query(1, ge=1), pageSize: int = Query(25, ge=5, le=100),
):
    d = store.subset(f)
    d = d[_search_mask(d, q)]
    col, asc = SORTS.get(sort, SORTS["recent"])
    d = d.sort_values(col, ascending=asc, na_position="last", kind="stable")
    total = len(d)
    start = (page - 1) * pageSize
    items = [_job_summary(r) for r in d.iloc[start:start + pageSize].itertuples()]
    return {"total": total, "page": page, "pageSize": pageSize, "items": items}


@app.get("/api/jobs/{job_id}")
def job_detail(job_id: int):
    hit = store.df[store.df["jobId"] == job_id]
    if hit.empty:
        raise HTTPException(404, "Job not found")
    r = hit.iloc[0]
    similar = store.df[(store.df["roleCategory"] == r.roleCategory) & store.df["salary"].notna()]
    exp_peers = similar[similar["expAvg"].sub(r.expAvg).abs() <= 1.5] if pd.notna(r.expAvg) else similar
    return {
        **_job_summary(r),
        "titleRaw": r.title, "skills": list(r.skills), "cities": list(r.cities), "reviews": py(r.reviews),
        "salaryMin": py(r.salaryMin), "salaryMax": py(r.salaryMax), "location": r.locationRaw,
        "seniority": r.seniority, "description": store.description(job_id)[:6000],
        "peerMedian": med(exp_peers["salary"]), "peerCount": int(len(exp_peers)),
    }


@app.get("/api/export.csv")
def export_csv(f: Filters = Depends(get_filters), q: str = ""):
    d = store.subset(f)
    d = d[_search_mask(d, q)]
    cols = ["jobId", "titleClean", "company", "roleCategory", "seniority", "primaryCity", "workMode",
            "salaryMin", "salaryMax", "salary", "expMin", "expMax", "rating", "reviews", "postedText"]
    out = d[cols].copy()
    out["skills"] = d["skills"].map(lambda s: ", ".join(s))
    buf = io.StringIO()
    out.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=indian_jobs_filtered.csv"},
    )


# --------------------------------------------------------------------------- #
# Serve the built React app (single-service deploy)
# --------------------------------------------------------------------------- #
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = DIST / path
        if path and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
