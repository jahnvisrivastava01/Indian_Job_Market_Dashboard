"""In-memory data store + filtering helpers shared by all routes."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import cached_property

import numpy as np
import pandas as pd

import pyarrow.parquet as pq

from .pipeline import CLEAN_PATH, EXPERIENCE_LABELS, load_clean


@dataclass(frozen=True)
class Filters:
    cities: tuple[str, ...] = ()
    roles: tuple[str, ...] = ()
    exp: tuple[str, ...] = ()
    modes: tuple[str, ...] = ()
    seniority: tuple[str, ...] = ()
    skills: tuple[str, ...] = ()
    disclosed: bool = False
    min_rating: float = 0.0

    @staticmethod
    def parse(cities="", roles="", exp="", modes="", seniority="", skills="",
              disclosed=False, min_rating=0.0) -> "Filters":
        def split(s: str) -> tuple[str, ...]:
            return tuple(sorted({x.strip() for x in (s or "").split("|") if x.strip()}))
        return Filters(split(cities), split(roles), split(exp), split(modes), split(seniority),
                       tuple(sorted({x.lower() for x in split(skills)})), bool(disclosed), float(min_rating or 0))


class Store:
    def __init__(self) -> None:
        load_clean()  # builds the parquet on first run
        # Descriptions are ~70% of the data's memory; they're read per-job on demand instead.
        cols = [c for c in pq.read_schema(CLEAN_PATH).names if c != "description"]
        df = pd.read_parquet(CLEAN_PATH, columns=cols)
        df["skills"] = df["skills"].map(lambda a: list(a) if a is not None else [])
        df["cities"] = df["cities"].map(lambda a: list(a) if a is not None else [])
        self.df = df
        n = len(df)
        self.n = n

        # Exploded helper tables (row index -> value)
        cx = df[["cities"]].explode("cities").dropna()
        self.city_rows = pd.DataFrame({"row": cx.index.to_numpy(), "city": cx["cities"].to_numpy()})
        sx = df[["skills"]].explode("skills").dropna()
        self.skill_rows = pd.DataFrame({"row": sx.index.to_numpy(), "skill": sx["skills"].to_numpy()})

        self.city_index = {c: g["row"].to_numpy() for c, g in self.city_rows.groupby("city")}
        self.skill_index = {s: g["row"].to_numpy() for s, g in self.skill_rows.groupby("skill")}

        self.salary = df["salary"].to_numpy()
        self.overall_median = float(np.nanmedian(self.salary))

        self.city_counts = self.city_rows["city"].value_counts()
        self.skill_counts = self.skill_rows["skill"].value_counts()

    # ------------------------------------------------------------------ #
    def mask(self, f: Filters) -> np.ndarray:
        df = self.df
        m = np.ones(self.n, dtype=bool)
        if f.cities:
            cm = np.zeros(self.n, dtype=bool)
            for c in f.cities:
                idx = self.city_index.get(c)
                if idx is not None:
                    cm[idx] = True
            if "Remote" in f.cities:
                cm |= df["workMode"].eq("Remote").to_numpy()
            m &= cm
        if f.roles:
            m &= df["roleCategory"].isin(f.roles).to_numpy()
        if f.exp:
            m &= df["expBand"].isin(f.exp).to_numpy()
        if f.modes:
            m &= df["workMode"].isin(f.modes).to_numpy()
        if f.seniority:
            m &= df["seniority"].isin(f.seniority).to_numpy()
        for s in f.skills:
            sm = np.zeros(self.n, dtype=bool)
            idx = self.skill_index.get(s)
            if idx is not None:
                sm[idx] = True
            m &= sm
        if f.disclosed:
            m &= ~np.isnan(self.salary)
        if f.min_rating > 0:
            m &= (df["rating"].fillna(0) >= f.min_rating).to_numpy()
        return m

    def subset(self, f: Filters) -> pd.DataFrame:
        return self.df[self.mask(f)]

    def description(self, job_id: int) -> str:
        t = pq.read_table(CLEAN_PATH, columns=["description"], filters=[("jobId", "==", int(job_id))])
        return t.column(0)[0].as_py() if t.num_rows else ""

    def rows_mask_to_set(self, m: np.ndarray) -> np.ndarray:
        return np.flatnonzero(m)


EXP_ORDER = EXPERIENCE_LABELS + ["Not stated"]
SENIORITY_ORDER = ["Entry / Intern", "Junior / Associate", "Not stated", "Senior", "Lead / Principal",
                   "Manager", "Leadership"]
SALARY_BANDS = [
    (0, 300_000, "< 3 LPA"),
    (300_000, 500_000, "3–5 LPA"),
    (500_000, 800_000, "5–8 LPA"),
    (800_000, 1_200_000, "8–12 LPA"),
    (1_200_000, 2_000_000, "12–20 LPA"),
    (2_000_000, 3_500_000, "20–35 LPA"),
    (3_500_000, np.inf, "35+ LPA"),
]


def py(v):
    """Make numpy / pandas scalars JSON-friendly."""
    if v is None:
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return None if np.isnan(v) else round(float(v), 2)
    return v


def med(s: pd.Series | np.ndarray):
    a = np.asarray(s, dtype=float)
    a = a[~np.isnan(a)]
    return py(np.median(a)) if len(a) else None
