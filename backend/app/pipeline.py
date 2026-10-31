"""
Data pipeline: raw Naukri-style Excel export -> clean, analysis-ready parquet.

Run directly:  python -m app.pipeline
The API also runs it automatically on first start if the parquet is missing.

What it fixes compared to the original notebook / Streamlit app:
  * Multi-city locations ("Hyderabad, Chennai, Bengaluru") are split into a list
    and normalised ("Bangalore" -> "Bengaluru", "Hybrid - Pune" -> "Pune").
  * Work mode (Remote / Hybrid / On-site) is derived from the location field.
  * USD salaries are kept out of INR salary statistics.
  * Zero / implausible salaries are treated as "not disclosed".
  * Skills are tokenised into a list, lower-cased and de-duplicated with an
    alias map ("react.js", "reactjs" -> "react"), so exact-match lookups work
    ("java" no longer matches "javascript").
  * 55k free-text job titles are mapped to ~18 role categories and a
    seniority level.
  * "6 Days Ago" style strings become a numeric posting age.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "indian-job-market-dataset-2025.xlsx"
CLEAN_PATH = DATA_DIR / "jobs_clean.parquet"

# --------------------------------------------------------------------------- #
# Locations
# --------------------------------------------------------------------------- #
CITY_ALIASES = {
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "bangalore rural": "Bengaluru",
    "bengaluru rural": "Bengaluru",
    "gurgaon": "Gurugram",
    "gurugram": "Gurugram",
    "new delhi": "Delhi",
    "delhi": "Delhi",
    "delhi / ncr": "Delhi",
    "delhi ncr": "Delhi",
    "mumbai suburban": "Mumbai",
    "mumbai (all areas)": "Mumbai",
    "bombay": "Mumbai",
    "ernakulam": "Kochi",
    "cochin": "Kochi",
    "pimpri-chinchwad": "Pune",
    "mysore": "Mysuru",
    "trivandrum": "Thiruvananthapuram",
    "vizag": "Visakhapatnam",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "secunderabad": "Hyderabad",
    "tiruchirapalli": "Tiruchirappalli",
    "trichy": "Tiruchirappalli",
}


def parse_locations(raw: str) -> tuple[list[str], str]:
    """Return (list of canonical cities, work mode)."""
    if not isinstance(raw, str) or not raw.strip():
        return [], "On-site"
    mode = "On-site"
    cities: list[str] = []
    for token in raw.split(","):
        t = re.sub(r"\(.*?\)", "", token).strip()
        low = t.lower()
        if not t:
            continue
        if "remote" in low or "work from home" in low or low == "wfh":
            mode = "Remote"
            continue
        if low.startswith("hybrid"):
            if mode != "Remote":
                mode = "Hybrid"
            t = re.sub(r"^hybrid\s*-\s*", "", t, flags=re.I).strip()
            low = t.lower()
            if not t:
                continue
        canon = CITY_ALIASES.get(low, t.title() if t.islower() or t.isupper() else t)
        if canon not in cities:
            cities.append(canon)
    return cities, mode


# --------------------------------------------------------------------------- #
# Job titles -> role category & seniority
# --------------------------------------------------------------------------- #
# Order matters: the first matching rule wins, so specific families go first.
ROLE_RULES: list[tuple[str, str]] = [
    ("Data & AI", r"data scien|data analy|data engineer|machine learning|\bml\b|\bai\b|artificial intelligence|"
                  r"gen ?ai|\bllm|deep learning|\bnlp\b|computer vision|analytics|business intelligence|\bbi\b|"
                  r"power ?bi|tableau|big data|databricks|snowflake|data architect|statistic|data modell?er|etl|decision sci"),
    ("Cybersecurity", r"security|cyber|\bsoc\b|penetration|vapt|\biam\b|infosec|firewall"),
    ("DevOps & Cloud", r"devops|dev ops|cloud|\bsre\b|site reliability|\baws\b|azure|\bgcp\b|kubernetes|"
                       r"infrastructure|platform engineer|terraform|mlops"),
    ("QA & Testing", r"\bqa\b|tester|testing|\bsdet\b|test engineer|test lead|test analyst|quality analyst|automation test"),
    ("ERP & Enterprise Apps", r"\bsap\b|oracle|\berp\b|salesforce|servicenow|workday|dynamics|guidewire|pega|mainframe"),
    ("Product & Design", r"product manager|product owner|product lead|ui ?/ ?ux|\bux\b|designer|graphic|creative|"
                         r"video editor|animator|illustrator"),
    ("Software Engineering", r"developer|software|\bsde\b|programmer|full ?stack|front ?end|back ?end|application lead|"
                             r"application developer|\bweb\b|mobile|android|\bios\b|react|angular|node|\bjava\b|\.net|"
                             r"dotnet|python|\bphp\b|golang|flutter|technical lead|tech lead|solution architect|"
                             r"software architect|\bc\+\+|embedded software|engineer - (?:java|python)"),
    ("IT Support & Networking", r"support engineer|desktop support|network|system admin|sysadmin|it support|"
                                r"technical support|help ?desk|linux admin|\bdba\b|database admin|it executive|"
                                r"service desk|\bnoc\b|it infra|tech support|support practitioner|application support|computer operator"),
    ("Customer Support & BPO", r"customer|\bbpo\b|voice|call cent|chat process|non[- ]voice|process associate|"
                               r"trust (?:&|and) safety|\bcsr\b|tele ?call|kyc|\bkpo\b|international process|chat support|\bcrm executive|"
                               r"ar caller|client acquisition"),
    ("Sales & Business Development", r"sales|business development|\bbde\b|\bbdm\b|\bbdo\b|account manager|key account|"
                                     r"relationship (?:manager|officer|executive)|territory|channel|pre-?sales|"
                                     r"branch manager|area manager|cluster manager|insurance advisor|"
                                     r"business associate|counsell?or - admission|field officer|agency"),
    ("Marketing & Content", r"marketing|\bseo\b|social media|content|brand|copywriter|\bpr\b|public relation|"
                            r"communications|growth|campaign|media|writer|journalist|editor|e-?commerce"),
    ("HR & Recruitment", r"\bhr\b|human resource|recruit|talent acquisition|payroll|\bhrbp\b|people partner|"
                         r"staffing|sourc(?:ing|er)"),
    ("Finance & Accounting", r"account|finance|financial|audit|\btax|\bgst\b|\bca\b|chartered|credit|loan|banking|"
                             r"treasury|investment|fp&a|billing|collection|underwrit|actuar|equity|mutual fund|"
                             r"wealth|\btds\b|cashier|teller|record to report|debt|accounts? payable|receivable"),
    ("Healthcare & Pharma", r"nurse|doctor|medical|pharma|clinical|physician|health ?care|hospital|\blab\b|"
                            r"dental|physiotherap|radiolog|pathology|\bmbbs\b|\bbams\b|dietitian|optometr|"
                            r"regulatory affairs|drug safety|pharmacovigilance|\bcoder\b|medical coding"),
    ("Core Engineering", r"mechanical|electrical|civil|production|manufactur|plant|maintenance|quality engineer|"
                         r"quality control|\bqc\b|design engineer|autocad|site engineer|electronics|embedded|vlsi|"
                         r"hardware|chemical|cnc|tool|process engineer|piping|hvac|instrumentation|automobile|"
                         r"service engineer|field engineer|structural|draughts|draftsman|welding|fitter|machin|electrician|"
                         r"surveyor|safety officer|\behs\b|site supervisor|supervisor|assessor|quality executive"),
    ("Hospitality & Retail", r"housekeeping|steward|\bcommis\b|\bchef\b|guest service|hotel|restaurant|f&b|"
                             r"front desk|retail|store manager|cashier|barista|bartender|travel"),
    ("Education & Training", r"teacher|trainer|faculty|professor|tutor|lecturer|educator|teaching|academic|"
                             r"principal|school|\bpgt\b|\btgt\b|curriculum|instructional"),
    ("Operations & Supply Chain", r"operations|supply chain|logistic|procurement|purchase|warehouse|inventory|"
                                  r"store|admin|back office|\bmis\b|data entry|executive assistant|secretary|"
                                  r"front office|receptionist|coordinator|dispatch|fleet|import|export|vendor|"
                                  r"facility|documentation|merchandis|office assistant|office boy|personal assistant|tender|"
                                  r"field executive|back-office"),
    ("Legal & Compliance", r"legal|lawyer|advocate|compliance|company secretary|\bcs\b|paralegal|counsel"),
    ("Management & Consulting", r"manager|consultant|lead|head|director|\bvp\b|vice president|general manager|"
                                r"business analyst|project|program|scrum|delivery|strategy|chief|ceo|cto|coo|"
                                r"partner|associate director"),
    ("Engineering (General)", r"engineer|engineering|technician|architect"),
]
ROLE_PATTERNS = [(name, re.compile(rx, re.I)) for name, rx in ROLE_RULES]

SENIORITY_RULES: list[tuple[str, str]] = [
    ("Leadership", r"\bhead\b|director|\bvp\b|vice president|chief|\bcxo\b|\bcto\b|\bceo\b|\bcoo\b|\bcfo\b|"
                   r"general manager|\bgm\b|\bavp\b"),
    ("Manager", r"manager|\bmgr\b"),
    ("Lead / Principal", r"\blead\b|principal|\bstaff\b|architect|team leader|\btl\b"),
    ("Senior", r"\bsenior\b|\bsr\.?\b|specialist|\biii\b"),
    ("Junior / Associate", r"junior|\bjr\.?\b|associate|assistant|\bii\b"),
    ("Entry / Intern", r"intern|trainee|fresher|graduate|apprentice|entry level"),
]
SENIORITY_PATTERNS = [(name, re.compile(rx, re.I)) for name, rx in SENIORITY_RULES]

TITLE_NOISE = re.compile(
    r"^(?:urgent(?:ly)?\s+)?(?:hiring|openings?|requirements?|vacanc(?:y|ies)|walk[- ]?ins?|we\s+are\s+hiring|"
    r"immediate(?:\s+joiners?)?)\b\s*(?:for|of|:|-)?\s*(?:an?\s+)?",
    re.I,
)


def clean_title(raw: str) -> str:
    if not isinstance(raw, str):
        return ""
    t = re.sub(r"[\(\[\{].*?[\)\]\}]", " ", raw)
    t = TITLE_NOISE.sub("", t.strip())
    t = re.sub(r"\s*[-|@]\s*(?:immediate.*|urgent.*|wfh|wfo|remote|hybrid|work from.*)$", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -|,.:!*")
    if t.isupper() and len(t) > 4:
        t = t.title()
    return t or raw.strip()


def classify(title: str, patterns) -> str | None:
    for name, rx in patterns:
        if rx.search(title):
            return name
    return None


# --------------------------------------------------------------------------- #
# Skills
# --------------------------------------------------------------------------- #
SKILL_ALIASES = {
    "react.js": "react", "reactjs": "react", "react js": "react", "reacts js": "react",
    "node.js": "node.js", "nodejs": "node.js", "node js": "node.js", "node": "node.js",
    "java script": "javascript", "js": "javascript",
    "type script": "typescript",
    "angularjs": "angular", "angular.js": "angular", "angular js": "angular",
    "vue.js": "vue", "vuejs": "vue",
    "next.js": "next.js", "nextjs": "next.js",
    "microsoft azure": "azure", "azure cloud": "azure",
    "amazon web services": "aws", "aws cloud": "aws",
    "google cloud": "gcp", "google cloud platform": "gcp",
    "ms excel": "excel", "advanced excel": "excel", "microsoft excel": "excel",
    "ms office": "ms office", "ms office tools": "ms office", "ms office suite": "ms office",
    "microsoft office": "ms office",
    "c sharp": "c#", "dotnet": ".net", "dot net": ".net", ".net core": ".net core",
    "asp.net mvc": "asp.net mvc", "asp .net": "asp.net",
    "ml": "machine learning", "ai": "artificial intelligence", "genai": "generative ai", "gen ai": "generative ai",
    "powerbi": "power bi", "postgres": "postgresql", "mongo db": "mongodb",
    "ci cd": "ci/cd", "cicd": "ci/cd",
    "communication": "communication skills", "good communication": "communication skills",
    "excellent communication": "communication skills", "good communication skills": "communication skills",
    "springboot": "spring boot", "k8s": "kubernetes",
    "rest api": "rest api", "restful": "rest api", "rest": "rest api", "restful api": "rest api",
    "restful apis": "rest api", "rest apis": "rest api",
    "html5": "html", "css3": "css", "tailwind css": "tailwind",
    "my sql": "mysql", "ms sql": "sql server", "mssql": "sql server", "ms sql server": "sql server",
    "py": "python", "python3": "python",
    "golang": "go",
    "deep learning": "deep learning", "nlp": "nlp", "natural language processing": "nlp",
    "large language models": "llm", "llms": "llm",
}

SKILL_STOPLIST = {
    "senior", "junior", "fresher", "freshers", "development", "coding", "engineering", "process",
    "computer science", "it", "software", "technology", "b.tech", "graduate", "mba", "any graduate",
    "data", "design", "engineer", "developer", "manager", "management", "executive", "hiring",
    "senior software engineer", "software engineer", "software engineering", "machine", "lead", "core",
    "",
}


def parse_skills(raw: str) -> list[str]:
    if not isinstance(raw, str):
        return []
    out: list[str] = []
    for s in raw.split(","):
        k = re.sub(r"\s+", " ", s.strip().lower())
        k = SKILL_ALIASES.get(k, k)
        if k in SKILL_STOPLIST or len(k) > 40:
            continue
        if k not in out:
            out.append(k)
    return out


# --------------------------------------------------------------------------- #
# Misc fields
# --------------------------------------------------------------------------- #
def posting_age_days(raw: str) -> float:
    if not isinstance(raw, str):
        return np.nan
    low = raw.lower()
    if low in {"just now", "today", "few hours ago"} or "hour" in low:
        return 0.0
    m = re.match(r"(\d+)\+?\s*days?\s+ago", low)
    if m:
        return float(m.group(1))
    return np.nan


TAG_RE = re.compile(r"<[^>]+>")


def clean_description(raw: str) -> str:
    if not isinstance(raw, str):
        return ""
    t = re.sub(r"<br\s*/?>|</p>|</li>", "\n", raw, flags=re.I)
    t = TAG_RE.sub(" ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n\n", t)
    return t.strip()


EXPERIENCE_BINS = [-1, 1, 3, 5, 8, 12, np.inf]
EXPERIENCE_LABELS = ["0–1 yrs", "1–3 yrs", "3–5 yrs", "5–8 yrs", "8–12 yrs", "12+ yrs"]

# Annual INR salary sanity bounds. Below ~₹60k/yr is almost always a monthly
# figure entered in the annual field; above ₹3 Cr is almost always a typo.
SALARY_MIN, SALARY_MAX = 60_000, 30_000_000


def build(raw_path: Path = RAW_PATH, out_path: Path = CLEAN_PATH) -> pd.DataFrame:
    print(f"[pipeline] reading {raw_path.name} …")
    df = pd.read_excel(raw_path)

    out = pd.DataFrame()
    out["jobId"] = df["jobId"].astype("int64")
    out["title"] = df["title"].fillna("").astype(str).str.strip()
    out["titleClean"] = out["title"].map(clean_title)
    out["roleCategory"] = out["title"].map(lambda t: classify(t, ROLE_PATTERNS) or "Other")
    out["seniority"] = out["title"].map(lambda t: classify(t, SENIORITY_PATTERNS) or "Not stated")
    out["company"] = df["companyName"].fillna("Unknown").astype(str).str.strip()
    out["companyId"] = df["companyId"].astype("int64")
    out["rating"] = df["AggregateRating"].astype(float)
    out["reviews"] = df["ReviewsCount"].astype(float)

    parsed = df["location"].map(parse_locations)
    out["cities"] = parsed.map(lambda x: x[0])
    out["workMode"] = parsed.map(lambda x: x[1])
    out["primaryCity"] = out["cities"].map(lambda c: c[0] if c else "Remote / Unspecified")
    out["locationRaw"] = df["location"].fillna("").astype(str)

    out["currency"] = df["currency"].fillna("INR")
    sal_min = df["minimumSalary"].replace(0, np.nan)
    sal_max = df["maximumSalary"].replace(0, np.nan)
    inr = out["currency"].eq("INR")
    avg = (sal_min + sal_max) / 2
    valid = inr & avg.between(SALARY_MIN, SALARY_MAX)
    out["salaryMin"] = sal_min.where(valid)
    out["salaryMax"] = sal_max.where(valid)
    out["salary"] = avg.where(valid)
    out["salaryText"] = df["salary"].fillna("Not disclosed").astype(str)

    out["expMin"] = df["minimumExperience"].astype(float)
    out["expMax"] = df["maximumExperience"].astype(float)
    out["expAvg"] = (out["expMin"] + out["expMax"]) / 2
    out["expBand"] = pd.cut(out["expAvg"], bins=EXPERIENCE_BINS, labels=EXPERIENCE_LABELS).astype(str)
    out.loc[out["expAvg"].isna(), "expBand"] = "Not stated"
    out["experienceText"] = df["experience"].fillna("Not stated").astype(str)

    out["skills"] = df["tagsAndSkills"].map(parse_skills)
    out["postedText"] = df["jobUploaded"].fillna("").astype(str)
    out["postedDaysAgo"] = df["jobUploaded"].map(posting_age_days)
    out["description"] = df["jobDescription"].map(clean_description)

    before = len(out)
    out = out.drop_duplicates(subset="jobId", keep="first").reset_index(drop=True)
    print(f"[pipeline] dropped {before - len(out):,} duplicate job IDs")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(out_path, index=False)
    print(f"[pipeline] wrote {len(out):,} rows -> {out_path.name}")
    return out


def load_clean() -> pd.DataFrame:
    if not CLEAN_PATH.exists():
        build()
    return pd.read_parquet(CLEAN_PATH)


if __name__ == "__main__":
    d = build()
    print(d["roleCategory"].value_counts())
    print(d["seniority"].value_counts())
    print(d["workMode"].value_counts())
    print("salary disclosed:", d["salary"].notna().mean().round(3))
