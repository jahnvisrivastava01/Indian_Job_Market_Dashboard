"""
Salary range predictor.

Three HistGradientBoosting quantile regressors (P10 / P50 / P90) trained on
log(annual INR salary) for listings that disclose a salary. Inputs are things a
job-seeker actually knows: role family, seniority, city, work mode, years of
experience and skills.

Run directly to (re)train:  python -m app.ml
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import train_test_split

from .pipeline import DATA_DIR, load_clean

MODEL_PATH = DATA_DIR / "salary_model.joblib"
CARD_PATH = DATA_DIR / "model_card.json"

N_CITIES = 30
N_SKILLS = 400
CAT_COLS = ["roleCategory", "seniority", "city", "workMode"]
NUM_COLS = ["expMin", "expMax", "nSkills"]
QUANTILES = {"p10": 0.10, "p50": 0.50, "p90": 0.90}


class SalaryModel:
    def __init__(self, models, categories, skills, card):
        self.models = models            # {"p10": est, ...}
        self.categories = categories    # {col: [levels]}
        self.skills = skills            # [skill]
        self.card = card

    # ---------------- features ---------------- #
    def _frame(self, rows: list[dict]) -> pd.DataFrame:
        X = pd.DataFrame(index=range(len(rows)))
        for col in CAT_COLS:
            levels = self.categories[col]
            fallback = "Other" if "Other" in levels else levels[0]
            vals = [r.get(col) if r.get(col) in levels else fallback for r in rows]
            X[col] = pd.Categorical(vals, categories=levels).codes
        X["expMin"] = [float(r.get("expMin", 0)) for r in rows]
        X["expMax"] = [float(r.get("expMax", r.get("expMin", 0))) for r in rows]
        skill_index = {s: i for i, s in enumerate(self.skills)}
        mh = np.zeros((len(rows), len(self.skills)), dtype=np.int8)
        n = []
        for i, r in enumerate(rows):
            sk = r.get("skills") or []
            n.append(len(sk))
            for s in sk:
                j = skill_index.get(s)
                if j is not None:
                    mh[i, j] = 1
        X["nSkills"] = n
        sk_df = pd.DataFrame(mh, columns=[f"sk::{s}" for s in self.skills])
        return pd.concat([X, sk_df], axis=1)

    def predict(self, rows: list[dict]) -> dict[str, np.ndarray]:
        X = self._frame(rows)
        out = {k: np.exp(m.predict(X)) for k, m in self.models.items()}
        # Quantile models are trained independently; enforce ordering.
        stacked = np.sort(np.vstack([out["p10"], out["p50"], out["p90"]]), axis=0)
        return {"p10": stacked[0], "p50": stacked[1], "p90": stacked[2]}


def _training_frame(df: pd.DataFrame, cities: list[str], skills: list[str]) -> tuple[list[dict], np.ndarray]:
    d = df[df["salary"].notna() & df["expMin"].notna()].copy()
    # Trim extreme tails so a few mis-keyed listings don't dominate.
    lo, hi = d["salary"].quantile([0.005, 0.995])
    d = d[d["salary"].between(lo, hi)]
    city_set = set(cities)
    rows = [
        {
            "roleCategory": r.roleCategory,
            "seniority": r.seniority,
            "city": r.primaryCity if r.primaryCity in city_set else "Other",
            "workMode": r.workMode,
            "expMin": r.expMin,
            "expMax": r.expMax,
            "skills": list(r.skills),
        }
        for r in d.itertuples()
    ]
    return rows, np.log(d["salary"].to_numpy())


def train(df: pd.DataFrame | None = None) -> SalaryModel:
    t0 = time.time()
    df = load_clean() if df is None else df
    disclosed = df[df["salary"].notna()]
    cities = disclosed["primaryCity"].value_counts().head(N_CITIES).index.tolist()
    skills = disclosed["skills"].explode().value_counts().head(N_SKILLS).index.tolist()
    categories = {
        "roleCategory": sorted(df["roleCategory"].unique().tolist()),
        "seniority": sorted(df["seniority"].unique().tolist()),
        "city": sorted(cities) + ["Other"],
        "workMode": sorted(df["workMode"].unique().tolist()),
    }
    rows, y = _training_frame(df, cities, skills)
    shell = SalaryModel({}, categories, skills, {})
    X = shell._frame(rows)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

    cat_mask = [c in CAT_COLS for c in X.columns]
    models = {}
    for name, q in QUANTILES.items():
        m = HistGradientBoostingRegressor(
            loss="quantile", quantile=q, max_iter=400, learning_rate=0.06,
            max_leaf_nodes=48, min_samples_leaf=30, l2_regularization=1.0,
            categorical_features=cat_mask, random_state=42,
        )
        m.fit(X_tr, y_tr)
        models[name] = m
        print(f"[ml] trained {name} ({time.time() - t0:.0f}s)")

    p50 = models["p50"].predict(X_te)
    p10 = models["p10"].predict(X_te)
    p90 = models["p90"].predict(X_te)
    actual, pred = np.exp(y_te), np.exp(p50)
    ape = np.abs(pred - actual) / actual
    ss_res = np.sum((y_te - p50) ** 2)
    ss_tot = np.sum((y_te - y_te.mean()) ** 2)
    baseline_ape = np.abs(np.exp(np.median(y_tr)) - actual) / actual

    # Grouped permutation importance on the P50 model (increase in MAE of log salary).
    rng = np.random.default_rng(0)
    base_err = np.mean(np.abs(y_te - p50))
    groups = {
        "Role category": ["roleCategory"],
        "Seniority (from title)": ["seniority"],
        "City": ["city"],
        "Work mode": ["workMode"],
        "Experience": ["expMin", "expMax"],
        "Skills": [c for c in X.columns if c.startswith("sk::")] + ["nSkills"],
    }
    importance = {}
    for gname, cols in groups.items():
        Xp = X_te.copy()
        perm = rng.permutation(len(Xp))
        Xp[cols] = Xp[cols].to_numpy()[perm]
        err = np.mean(np.abs(y_te - models["p50"].predict(Xp)))
        importance[gname] = float(max(err - base_err, 0))
    total = sum(importance.values()) or 1
    importance = {k: round(v / total, 4) for k, v in sorted(importance.items(), key=lambda kv: -kv[1])}

    card = {
        "trainedOn": int(len(X_tr)),
        "testedOn": int(len(X_te)),
        "target": "Annual salary (INR), midpoint of the advertised range",
        "algorithm": "HistGradientBoosting quantile regression (P10 / P50 / P90) on log salary",
        "metrics": {
            "r2Log": round(float(1 - ss_res / ss_tot), 3),
            "medianAbsPctError": round(float(np.median(ape)), 3),
            "baselineMedianAbsPctError": round(float(np.median(baseline_ape)), 3),
            "within25Pct": round(float(np.mean(ape <= 0.25)), 3),
            "intervalCoverage": round(float(np.mean((y_te >= p10) & (y_te <= p90))), 3),
            "maeINR": round(float(np.mean(np.abs(pred - actual))), 0),
        },
        "featureImportance": importance,
        "skillsUsed": len(skills),
        "citiesUsed": len(cities),
        "trainSeconds": round(time.time() - t0, 1),
    }
    model = SalaryModel(models, categories, skills, card)
    joblib.dump({"models": models, "categories": categories, "skills": skills, "card": card}, MODEL_PATH)
    CARD_PATH.write_text(json.dumps(card, indent=2))
    print("[ml] model card:", json.dumps(card["metrics"]), card["featureImportance"])
    return model


def load_model(df: pd.DataFrame | None = None) -> SalaryModel:
    if MODEL_PATH.exists():
        b = joblib.load(MODEL_PATH)
        return SalaryModel(b["models"], b["categories"], b["skills"], b["card"])
    return train(df)


if __name__ == "__main__":
    train()
