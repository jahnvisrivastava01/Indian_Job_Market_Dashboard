import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_excel(
    "indian-job-market-dataset-2025.xlsx"
)

print("Shape:", df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 rows:")
print(df.head())

print("\nData types:")
print(df.dtypes)

print("\nMissing values:")
print(df.isnull().sum())


print("\n Data Quality")

print("duplicate rows: ")
print(df.duplicated().sum())

print("\n duplicate job ids:")
print(df["jobId"].duplicated().sum())

print("\nUnique companies:")
print(df["companyName"].nunique())

print("\nUnique locations:")
print(df["location"].nunique())

print("\nUnique job titles:")
print(df["title"].nunique())


top_roles=(
    df["title"].value_counts().head(20)

)
print("\n Top 20 Job Roles")
print(top_roles)

plt.figure(figsize=(10,7))
top_roles.sort_values().plot(
    kind="barh"
)

plt.title("Top 20 Job roles by number of listings")
plt.xlabel("Number of job listings")
plt.ylabel("job title")

plt.tight_layout()
plt.show()

top_locations =(
    df["location"].value_counts().head(20)


)

print("\n Top 20 Locations")
print(top_locations)

plt.figure(figsize=(10, 7))

top_locations.sort_values().plot(
    kind="barh"
)

plt.title("Top 20 Job Locations")
plt.xlabel("Number of Job Listings")
plt.ylabel("Location")

plt.tight_layout()
plt.show()

print("\n--- SALARY ---")

print(
    df[
        [
            "minimumSalary",
            "maximumSalary"
        ]
    ].describe()
)

df["averageSalary"] =(
    df["minimumSalary"]+df["maximumSalary"]

)/2

print(
    df["averageSalary"].describe()
)

print("\n--- SALARY DATA QUALITY ---")

print("Jobs with minimum salary = 0:",
      (df["minimumSalary"] == 0).sum())

print("Jobs with maximum salary = 0:",
      (df["maximumSalary"] == 0).sum())

print("Jobs with average salary = 0:",
      (df["averageSalary"] == 0).sum())

salary_zero_pct = (
    (df["averageSalary"] == 0).mean() * 100
)

print(
    f"Salary unavailable/zero: "
    f"{salary_zero_pct:.2f}%"
)

df["cleanSalary"] = df["averageSalary"].replace(
    0,np.nan
)

print(
    df["cleanSalary"].describe()
)

print(
    df[
        [
            "title",
            "companyName",
            "salary",
            "minimumSalary",
            "maximumSalary",
            "averageSalary"
        ]
    ]
    .sort_values(
        "averageSalary",
        ascending=False
    )
    .head(20)
    .to_string(index=False)
)

plt.figure(figsize=(10, 6))

plt.hist(
    df["cleanSalary"].dropna(),
    bins=40,
    edgecolor="black"
)

plt.title(
    "Distribution of Disclosed Job Salaries"
)

plt.xlabel("Average Salary")
plt.ylabel("Number of Jobs")

plt.tight_layout()
plt.show()

salary_percentiles = np.percentile(
    df["cleanSalary"].dropna(),
    [25, 50, 75, 90, 95, 99]
)

print("\n--- SALARY PERCENTILES ---")

for p, value in zip(
    [25, 50, 75, 90, 95, 99],
    salary_percentiles
):
    print(f"{p}th percentile: ₹{value:,.0f}")

df["salaryBand"] = pd.cut(
    df["cleanSalary"],
    bins=[
        0,
        300000,
        500000,
        800000,
        1200000,
         2000000,
        np.inf
    ],
    labels=[
        "< 3 LPA",
        "3–5 LPA",
        "5–8 LPA",
        "8–12 LPA",
        "12–20 LPA",
        "20+ LPA"
    ]
)

salary_bands=(
    df["salaryBand"]
    .value_counts()
    .sort_index()
)

print("\n Salary Bands")
print(salary_bands)

plt.figure(figsize=(10, 6))

salary_bands.plot(
    kind="bar"
)

plt.title("Distribution of Disclosed Job Salaries")
plt.xlabel("Salary Band")
plt.ylabel("Number of Jobs")

plt.xticks(rotation=30)

plt.tight_layout()
plt.show()


df["averageExperience"] = (
    df["minimumExperience"] +
    df["maximumExperience"]
) / 2

print("\n--- EXPERIENCE ANALYSIS ---")

print(
    df[
        [
            "minimumExperience",
            "maximumExperience",
            "averageExperience"
        ]
    ].describe()
)
df["experienceBand"] = pd.cut(
    df["averageExperience"],
    bins=[
        -1,
        1,
        3,
        5,
        8,
        12,
        np.inf
    ],
    labels=[
        "0–1 years",
        "1–3 years",
        "3–5 years",
        "5–8 years",
        "8–12 years",
        "12+ years"
    ]
)

experience_counts = (
    df["experienceBand"]
    .value_counts()
    .sort_index()
)

print("\nJobs by Experience Level:")
print(experience_counts)

plt.figure(figsize=(10, 6))

experience_counts.plot(
    kind="bar"
)

plt.title("Job Demand by Experience Level")
plt.xlabel("Experience")
plt.ylabel("Number of Job Listings")

plt.xticks(rotation=30)

plt.tight_layout()
plt.show()

experience_salary = (
    df
    .dropna(
        subset=[
            "experienceBand",
            "cleanSalary"
        ]
    )
    .groupby(
        "experienceBand",
        observed=True
    )
    .agg(
        jobs=("jobId", "count"),
        median_salary=("cleanSalary", "median"),
        average_salary=("cleanSalary", "mean")
    )
)

print("\n--- EXPERIENCE VS SALARY ---")
print(experience_salary)


plt.figure(figsize=(10,6))
experience_salary["median_salary"].plot(
    kind="bar"
)
plt.title("Median Salary by Experience Level")
plt.xlabel("Experience")
plt.ylabel("Median Salary")

plt.xticks(rotation=30)

plt.tight_layout()
plt.show()


skills=(
    df["tagsAndSkills"]
    .dropna()
    .str.split(" , ")
    .explode()
    .str.strip()
)

skills=skills[skills != ""]
top_skills = skills.value_counts().head(20)

print("\n--- RAW SKILLS ---")

print(
    df["tagsAndSkills"]
    .dropna()
    .head(10)
    .to_string(index=False)
)

print("\n--- SKILL VALUE EXAMPLE ---")

print(repr(df["tagsAndSkills"].dropna().iloc[0]))


skills = (
    df["tagsAndSkills"]
    .dropna()
    .str.split(",")
    .explode()
    .str.strip()
    .str.lower()
)

skills = skills[
    (skills != "") &
    (skills.notna())
]

top_skills = skills.value_counts().head(20)

print("\n--- TOP 20 SKILLS ---")
print(top_skills)


plt.figure(figsize=(10, 7))

top_skills.sort_values().plot(
    kind="barh"
)

plt.title("Top 20 Most Demanded Skills")
plt.xlabel("Number of Job Listings")
plt.ylabel("Skill")

plt.tight_layout()
plt.show()