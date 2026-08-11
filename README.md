# 🇮🇳 Indian Job Market Dashboard

An interactive data analytics dashboard built to explore the Indian job market using nearly **98K job listings**.

The project analyzes job demand, locations, salaries, experience requirements, companies, and in-demand skills using **Pandas, NumPy, Matplotlib, Plotly and Streamlit**.

## 🚀 Live Dashboard

👉 [Open Indian Job Market Dashboard](https://indianjobmarketdashboard-wytdt7kfy2e9rdgdhuavje.streamlit.app/)

## 📊 Project Overview

The Indian Job Market Intelligence Dashboard transforms a large job-listing dataset into an interactive analytics application.

The analysis focuses on:

- 💼 Most demanded job roles
- 📍 Job distribution across locations
- 🏢 Companies with the highest number of listings
- 💰 Salary distributions and salary bands
- 📈 Experience requirements
- 💻 Most demanded skills
- 🔗 Skill-to-salary analysis
- 🔍 Data quality and missing-value analysis

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| Python | Core programming |
| Pandas | Data cleaning and analysis |
| NumPy | Numerical analysis |
| Matplotlib | Exploratory data visualization |
| Plotly | Interactive visualizations |
| Streamlit | Dashboard development |
| Excel / OpenPyXL | Dataset loading |
| Git & GitHub | Version control |
| Streamlit Community Cloud | Deployment |

## 🔎 Analysis Performed

### 1. Data Exploration

- Dataset shape
- Column inspection
- Data types
- Missing values
- Duplicate rows
- Duplicate job IDs
- Unique companies
- Unique locations
- Unique job titles

### 2. Job Market Analysis

- Top job roles
- Most active hiring locations
- Companies with the highest number of job listings

### 3. Salary Analysis

- Minimum salary
- Maximum salary
- Average salary
- Median salary
- Salary percentiles
- Salary bands
- Salary distribution
- Salary data quality

Salary values are cleaned by treating zero salary values as unavailable rather than valid salaries.

Because the dataset contains extreme salary outliers, **median salary** is used for several comparisons to provide a more representative measure.

### 4. Experience Analysis

Job requirements are grouped into:

- 0–1 years
- 1–3 years
- 3–5 years
- 5–8 years
- 8–12 years
- 12+ years

The project also analyzes the relationship between experience requirements and median salary.

### 5. Skill Intelligence

Skills are extracted from the `tagsAndSkills` field and normalized for analysis.

The dashboard identifies the most frequently mentioned skills and provides a **Skill → Salary Analysis** where users can select a skill and examine its job frequency and salary statistics.

## 🎨 Streamlit Dashboard

### 📊 Dashboard

- Total job listings
- Companies
- Locations
- Salary disclosure
- Top job roles
- Data quality indicators
- Quick insights

### 💼 Job Market

- Top job roles
- Top locations
- Top hiring companies

### 💰 Salary Analytics

- Median salary
- Highest disclosed salary
- Salary distribution
- Salary bands
- Median salary by experience level
- Salary data-quality explanation

### 🧑‍💻 Skills

- Top 20 skills
- Skill frequency table
- Skill → salary analysis

## 🎛️ Interactive Filters

Users can filter the dashboard by:

- 📍 Location
- 💼 Experience level

This allows users to explore specific segments of the job market.

## 📌 Important Data Considerations

A significant portion of job listings does not contain disclosed salary information.

Therefore:

- Undisclosed salaries are not treated as zero.
- Salary analysis uses only valid disclosed salary values.
- Extreme salary values can significantly affect averages.
- Median salary is preferred for several comparisons.
- Salary distribution visualizations reduce the influence of extreme outliers.

## 📁 Project Structure

```text
Indian_Job_Market_Dashboard/
│
├── app.py
├── job_market_analysis.py
├── indian-job-market-dataset-2025.xlsx
├── requirements.txt
├── .gitignore
└── README.md
````

## ⚙️ Run Locally

```bash
git clone https://github.com/jahnvisrivastava01/Indian_Job_Market_Dashboard.git
cd Indian_Job_Market_Dashboard
pip install -r requirements.txt
streamlit run app.py
```

## 📈 Project Workflow

```text
Raw Dataset
     ↓
Data Exploration
     ↓
Data Quality Analysis
     ↓
Data Cleaning
     ↓
Feature Engineering
     ↓
Salary Analysis
     ↓
Experience Analysis
     ↓
Skill Extraction
     ↓
Exploratory Data Analysis
     ↓
Interactive Dashboard
     ↓
Streamlit Deployment
```

## 🎯 Key Learning Outcomes

* Working with a large real-world dataset
* Pandas data manipulation
* NumPy numerical analysis
* Missing-value handling
* Outlier analysis
* Feature engineering
* GroupBy and aggregation
* Percentile analysis
* Text-based skill extraction
* Data visualization
* Interactive dashboard development
* Git/GitHub workflow
* Cloud deployment

## 👩‍💻 Author

**Jahnvi Srivastava**

---

⭐ If you found this project useful, consider giving the repository a star!


