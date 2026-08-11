import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

st.set_page_config(
    page_title="Indian Job Market Dashboard",
    page_icon="🇮🇳",
    layout="wide",
    initial_sidebar_state="expanded"
)

PRIMARY = "#6366F1"
PURPLE = "#7C3AED"
PINK = "#EC4899"
CYAN = "#06B6D4"
GREEN = "#10B981"
ORANGE = "#F59E0B"
NAVY = "#312E81"

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

.stApp {
    background:
        radial-gradient(circle at 10% 10%, rgba(124, 58, 237, 0.08), transparent 28%),
        radial-gradient(circle at 90% 20%, rgba(236, 72, 153, 0.07), transparent 28%),
        linear-gradient(135deg, #F8F7FF 0%, #F4F7FF 50%, #FFF8FC 100%);
}

[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #17113B 0%, #312E81 55%, #4C1D95 100%);
}

[data-testid="stSidebar"] * {
    color: white;
}

.main-title {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -1px;
    background: linear-gradient(90deg, #4F46E5, #7C3AED, #DB2777);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 5px;
}

.subtitle {
    color: #667085;
    font-size: 15px;
    margin-bottom: 30px;
}

.section-title {
    font-size: 21px;
    font-weight: 700;
    color: #27224A;
    margin-top: 28px;
    margin-bottom: 14px;
}

div[data-testid="metric-container"] {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #E7E4FF;
    padding: 20px 22px;
    border-radius: 18px;
    box-shadow: 0 8px 25px rgba(79, 70, 229, 0.08);
    transition: 0.2s ease;
}

div[data-testid="metric-container"]:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 32px rgba(79, 70, 229, 0.15);
}

div[data-testid="metric-container"] label {
    color: #667085 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
}

div[data-testid="metric-container"] div[data-testid="stMetricValue"] {
    color: #312E81 !important;
    font-size: 27px !important;
    font-weight: 800 !important;
}

[data-testid="stPlotlyChart"] {
    background: rgba(255,255,255,0.72);
    border: 1px solid #E8E6F5;
    border-radius: 18px;
    padding: 8px;
    box-shadow: 0 6px 20px rgba(16, 24, 40, 0.04);
}

[data-testid="stDataFrame"] {
    border-radius: 15px;
    overflow: hidden;
    border: 1px solid #E5E7EB;
}

div[data-baseweb="select"] > div {
    border-radius: 10px !important;
    border-color: #DDD6FE !important;
}

[data-testid="stRadio"] label {
    font-weight: 600;
}

.insight-card {
    background: linear-gradient(135deg, rgba(99,102,241,0.10), rgba(236,72,153,0.08));
    border: 1px solid #DDD6FE;
    border-left: 5px solid #7C3AED;
    border-radius: 14px;
    padding: 18px 20px;
    margin: 20px 0;
    color: #344054;
    font-size: 14px;
}

.info-card {
    background: rgba(255,255,255,0.8);
    border: 1px solid #E7E4FF;
    border-radius: 14px;
    padding: 16px 18px;
    margin: 12px 0;
    color: #475467;
    font-size: 13px;
}

.footer {
    text-align: center;
    color: #8A8FA3;
    font-size: 12px;
    padding: 25px 0 10px 0;
}
</style>
""", unsafe_allow_html=True)


@st.cache_data
def load_data():
    return pd.read_excel("indian-job-market-dataset-2025.xlsx")


df = load_data()

df["averageSalary"] = (
    df["minimumSalary"] +
    df["maximumSalary"]
) / 2

df["cleanSalary"] = df["averageSalary"].replace(0, np.nan)

df["averageExperience"] = (
    df["minimumExperience"] +
    df["maximumExperience"]
) / 2

df["experienceBand"] = pd.cut(
    df["averageExperience"],
    bins=[-1, 1, 3, 5, 8, 12, np.inf],
    labels=[
        "0–1 years",
        "1–3 years",
        "3–5 years",
        "5–8 years",
        "8–12 years",
        "12+ years"
    ]
)

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

st.sidebar.markdown(
    """
    # 🇮🇳 Job Market

    
    """
)

st.sidebar.markdown("---")

st.sidebar.markdown("### 🔎 Filters")

selected_locations = st.sidebar.multiselect(
    "Location",
    sorted(df["location"].dropna().unique()),
    max_selections=10
)

selected_experience = st.sidebar.multiselect(
    "Experience Level",
    df["experienceBand"].dropna().unique()
)

filtered_df = df.copy()

if selected_locations:
    filtered_df = filtered_df[
        filtered_df["location"].isin(selected_locations)
    ]

if selected_experience:
    filtered_df = filtered_df[
        filtered_df["experienceBand"].isin(selected_experience)
    ]

st.sidebar.markdown("---")

page = st.sidebar.radio(
    "NAVIGATION",
    [
        "Dashboard",
        "Job Market",
        "Salary Analytics",
        "Skills"
    ]
)

st.sidebar.markdown("---")

st.sidebar.markdown(
    """
    <div style="
        font-size:12px;
        opacity:0.65;
        line-height:1.6;
    ">
        Data Analytics Project<br>
        Pandas • NumPy • Matplotlib<br>
        Streamlit • Plotly
    </div>
    """,
    unsafe_allow_html=True
)


if page == "Dashboard":

    st.markdown(
        '<div class="main-title">Indian Job Market Dashboard</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">A data-driven view of jobs, salaries, experience and skills across India.</div>',
        unsafe_allow_html=True
    )

    total_jobs = len(filtered_df)
    total_companies = filtered_df["companyName"].nunique()
    total_locations = filtered_df["location"].nunique()

    salary_disclosure = (
        filtered_df["cleanSalary"].notna().mean() * 100
        if len(filtered_df) > 0
        else 0
    )

    c1, c2, c3, c4 = st.columns(4)

    with c1:
        st.metric("Total Job Listings", f"{total_jobs:,}")

    with c2:
        st.metric("Companies", f"{total_companies:,}")

    with c3:
        st.metric("Locations", f"{total_locations:,}")

    with c4:
        st.metric("Salary Disclosure", f"{salary_disclosure:.1f}%")

    st.markdown(
        '<div class="section-title">💼 Most Demanded Job Roles</div>',
        unsafe_allow_html=True
    )

    top_roles = (
        filtered_df["title"]
        .value_counts()
        .head(10)
        .sort_values()
    )

    fig = px.bar(
        x=top_roles.values,
        y=top_roles.index,
        orientation="h",
        color=top_roles.values,
        color_continuous_scale=["#DDD6FE", "#8B5CF6", "#4F46E5"]
    )

    fig.update_layout(
        height=500,
        coloraxis_showscale=False,
        xaxis_title="Job Listings",
        yaxis_title="Job Role",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=20, r=20, t=20, b=20)
    )

    st.plotly_chart(fig, use_container_width=True)

    top_location = (
        filtered_df["location"].value_counts().idxmax()
        if len(filtered_df) > 0
        else "N/A"
    )

    top_role = (
        filtered_df["title"].value_counts().idxmax()
        if len(filtered_df) > 0
        else "N/A"
    )

    st.markdown(
        f"""
        <div class="insight-card">
        <b>💡 Quick Insight</b><br><br>
        <b>{top_role}</b> is the most frequently listed role in the current selection,
        while <b>{top_location}</b> has the highest number of job listings.
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="section-title">🔍 Data Quality</div>',
        unsafe_allow_html=True
    )

    q1, q2, q3 = st.columns(3)

    with q1:
        st.metric(
            "Salary Unavailable",
            f"{filtered_df['cleanSalary'].isna().mean() * 100:.1f}%"
        )

    with q2:
        st.metric(
            "Duplicate Job IDs",
            f"{filtered_df['jobId'].duplicated().sum():,}"
        )

    with q3:
        st.metric(
            "Missing Skills",
            f"{filtered_df['tagsAndSkills'].isna().sum():,}"
        )

    st.info(
        "Salary analysis excludes undisclosed salaries instead of treating them as zero. "
        "Median salary is used where appropriate because the dataset contains extreme salary outliers."
    )


elif page == "Job Market":

    st.markdown(
        '<div class="main-title">Job Market Analysis</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">Explore job demand across roles, locations and employers.</div>',
        unsafe_allow_html=True
    )

    col1, col2 = st.columns(2)

    with col1:

        st.markdown(
            '<div class="section-title">💼 Top 15 Job Roles</div>',
            unsafe_allow_html=True
        )

        roles = (
            filtered_df["title"]
            .value_counts()
            .head(15)
            .sort_values()
        )

        fig = px.bar(
            x=roles.values,
            y=roles.index,
            orientation="h",
            color=roles.values,
            color_continuous_scale=["#DDD6FE", "#7C3AED", "#4F46E5"]
        )

        fig.update_layout(
            height=600,
            coloraxis_showscale=False,
            xaxis_title="Job Listings",
            yaxis_title="Job Role",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)"
        )

        st.plotly_chart(fig, use_container_width=True)

    with col2:

        st.markdown(
            '<div class="section-title">📍 Top 15 Locations</div>',
            unsafe_allow_html=True
        )

        locations = (
            filtered_df["location"]
            .value_counts()
            .head(15)
            .sort_values()
        )

        fig = px.bar(
            x=locations.values,
            y=locations.index,
            orientation="h",
            color=locations.values,
            color_continuous_scale=["#CFFAFE", "#06B6D4", "#0891B2"]
        )

        fig.update_layout(
            height=600,
            coloraxis_showscale=False,
            xaxis_title="Job Listings",
            yaxis_title="Location",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)"
        )

        st.plotly_chart(fig, use_container_width=True)

    st.markdown(
        '<div class="section-title">🏢 Top Hiring Companies</div>',
        unsafe_allow_html=True
    )

    top_companies = (
        filtered_df["companyName"]
        .dropna()
        .value_counts()
        .head(15)
        .sort_values()
    )

    fig = px.bar(
        x=top_companies.values,
        y=top_companies.index,
        orientation="h",
        color=top_companies.values,
        color_continuous_scale=["#CFFAFE", "#06B6D4", "#0891B2"]
    )

    fig.update_layout(
        height=550,
        coloraxis_showscale=False,
        xaxis_title="Job Listings",
        yaxis_title="Company",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )

    st.plotly_chart(fig, use_container_width=True)


elif page == "Salary Analytics":

    st.markdown(
        '<div class="main-title">Salary Analytics</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">Explore salary distribution and the relationship between experience and compensation.</div>',
        unsafe_allow_html=True
    )

    median_salary = filtered_df["cleanSalary"].median()
    highest_salary = filtered_df["cleanSalary"].max()
    disclosed_salaries = filtered_df["cleanSalary"].notna().sum()

    c1, c2, c3 = st.columns(3)

    with c1:
        st.metric(
            "Median Salary",
            f"₹{median_salary:,.0f}" if pd.notna(median_salary) else "N/A"
        )

    with c2:
        st.metric(
            "Highest Salary",
            f"₹{highest_salary:,.0f}" if pd.notna(highest_salary) else "N/A"
        )

    with c3:
        st.metric(
            "Disclosed Salaries",
            f"{disclosed_salaries:,}"
        )

    st.markdown(
        '<div class="section-title">💰 Salary Distribution</div>',
        unsafe_allow_html=True
    )

    salary_data = filtered_df["cleanSalary"].dropna()

    if len(salary_data) > 0:

        upper_limit = salary_data.quantile(0.99)

        salary_plot = salary_data[
            salary_data <= upper_limit
        ]

        fig = px.histogram(
            x=salary_plot,
            nbins=40,
            labels={"x": "Average Salary"},
            color_discrete_sequence=[PURPLE]
        )

        fig.update_layout(
            height=500,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)"
        )

        st.plotly_chart(fig, use_container_width=True)

        st.caption(
            "Salary distribution is shown up to the 99th percentile to reduce the visual impact of extreme outliers."
        )

    salary_bands = pd.cut(
        filtered_df["cleanSalary"],
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

    salary_band_counts = (
        salary_bands
        .value_counts()
        .sort_index()
        .reset_index()
    )

    salary_band_counts.columns = [
        "Salary Band",
        "Jobs"
    ]

    st.markdown(
        '<div class="section-title">📊 Salary Bands</div>',
        unsafe_allow_html=True
    )

    fig = px.bar(
        salary_band_counts,
        x="Salary Band",
        y="Jobs",
        color="Jobs",
        color_continuous_scale=["#FBCFE8", "#EC4899", "#7C3AED"]
    )

    fig.update_layout(
        height=450,
        coloraxis_showscale=False,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )

    st.plotly_chart(fig, use_container_width=True)

    experience_salary = (
        filtered_df
        .dropna(subset=["experienceBand", "cleanSalary"])
        .groupby("experienceBand", observed=True)
        .agg(
            jobs=("jobId", "count"),
            median_salary=("cleanSalary", "median")
        )
        .reset_index()
    )

    st.markdown(
        '<div class="section-title">📈 Median Salary by Experience</div>',
        unsafe_allow_html=True
    )

    fig = px.bar(
        experience_salary,
        x="experienceBand",
        y="median_salary",
        color="median_salary",
        color_continuous_scale=["#DDD6FE", "#8B5CF6", "#4F46E5"]
    )

    fig.update_layout(
        height=450,
        coloraxis_showscale=False,
        xaxis_title="Experience",
        yaxis_title="Median Salary",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )

    st.plotly_chart(fig, use_container_width=True)

    st.info(
        "Median salary is used for experience comparisons because salary distributions contain extreme high-value outliers."
    )


elif page == "Skills":

    st.markdown(
        '<div class="main-title">Skill Intelligence</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">Explore the skills most frequently mentioned in Indian job listings.</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="section-title">🧑‍💻 Top 20 Most Demanded Skills</div>',
        unsafe_allow_html=True
    )

    skill_data = top_skills.sort_values()

    fig = px.bar(
        x=skill_data.values,
        y=skill_data.index,
        orientation="h",
        color=skill_data.values,
        color_continuous_scale=["#FBCFE8", "#EC4899", "#7C3AED"]
    )

    fig.update_layout(
        height=650,
        coloraxis_showscale=False,
        xaxis_title="Job Listings",
        yaxis_title="Skill",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)"
    )

    st.plotly_chart(fig, use_container_width=True)

    st.markdown(
        '<div class="section-title">📋 Skill Frequency</div>',
        unsafe_allow_html=True
    )

    skill_table = top_skills.reset_index()

    skill_table.columns = [
        "Skill",
        "Job Listings"
    ]

    st.dataframe(
        skill_table,
        use_container_width=True,
        hide_index=True
    )

    st.markdown(
        '<div class="section-title">💰 Skill → Salary Analysis</div>',
        unsafe_allow_html=True
    )

    selected_skill = st.selectbox(
        "Select a skill",
        [
            "python",
            "java",
            "sql",
            "c#",
            "aws",
            "sap",
            "javascript",
            "react",
            "management",
            "sales"
        ]
    )

    skill_jobs = df[
        df["tagsAndSkills"]
        .fillna("")
        .str.lower()
        .str.contains(selected_skill, regex=False)
    ]

    skill_median = skill_jobs["cleanSalary"].median()
    skill_average = skill_jobs["cleanSalary"].mean()
    skill_job_count = len(skill_jobs)

    s1, s2, s3 = st.columns(3)

    with s1:
        st.metric(
            "Jobs Mentioning Skill",
            f"{skill_job_count:,}"
        )

    with s2:
        st.metric(
            "Median Salary",
            f"₹{skill_median:,.0f}"
            if pd.notna(skill_median)
            else "N/A"
        )

    with s3:
        st.metric(
            "Average Salary",
            f"₹{skill_average:,.0f}"
            if pd.notna(skill_average)
            else "N/A"
        )

    st.markdown(
        f"""
        <div class="insight-card">
        <b>💡 Skill Insight</b><br><br>
        Job listings mentioning <b>{selected_skill.upper()}</b>
        have a median disclosed salary of
        <b>₹{skill_median:,.0f}</b> based on the available salary data.
        </div>
        """,
        unsafe_allow_html=True
    )


st.markdown(
    """
    <div class="footer">
        🇮🇳 Indian Job Market Dashboard
        <br>
        Built by Jahnvi Srivastava
    </div>
    """,
    unsafe_allow_html=True
)