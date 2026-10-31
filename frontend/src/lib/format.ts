export const fmtInt = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("en-IN");

/** Annual INR -> "₹4.3 L" / "₹1.2 Cr" */
export const fmtLPA = (n: number | null | undefined, digits = 1) => {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  return `₹${(n / 1e5).toFixed(digits)} L`;
};

export const fmtPct = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : `${(n * 100).toFixed(digits)}%`;

export const fmtSignedPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(0)}%`;

export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

const UPPER = new Set([
  "sql", "css", "sap", "aws", "gcp", "html", "php", "api", "apis", "ui", "ux", "erp", "crm", "seo", "sem", "bpo", "kpo",
  "hr", "qa", "etl", "ml", "ai", "nlp", "llm", "dbms", "b2b", "b2c", "it", "ios", "mis", "gst", "tds", "rest", "ci/cd",
  "mvc", "jsp", "j2ee", "oop", "oops", "sdlc", "dnb", "mbbs", "ccna", "plc", "scada", "cnc", "hvac", "sas", "spss",
  "bi", "sap hana", "abap", "iam", "soc", "vapt", "devops", "ppc", "smm", "pmp", "ifrs", "fp&a", "kyc", "aml",
]);
const SPECIAL: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", "node.js": "Node.js", "next.js": "Next.js", mongodb: "MongoDB",
  mysql: "MySQL", postgresql: "PostgreSQL", github: "GitHub", gitlab: "GitLab", "c#": "C#", ".net": ".NET",
  "asp.net": "ASP.NET", "asp.net mvc": "ASP.NET MVC", ".net core": ".NET Core", "power bi": "Power BI",
  "ms office": "MS Office", "sql server": "SQL Server", "rest api": "REST API", fastapi: "FastAPI", graphql: "GraphQL",
  devops: "DevOps", pyspark: "PySpark", tensorflow: "TensorFlow", pytorch: "PyTorch", "scikit-learn": "scikit-learn",
  autocad: "AutoCAD", solidworks: "SolidWorks", salesforce: "Salesforce", servicenow: "ServiceNow", "ci/cd": "CI/CD",
  "b2b sales": "B2B Sales", "b2c sales": "B2C Sales", "sap hana": "SAP HANA", "generative ai": "Generative AI",
  llm: "LLM", jquery: "jQuery", "vue": "Vue", "react native": "React Native", "it": "IT",
};

/** Display-case a lower-cased skill ("rest api" -> "REST API", "java" -> "Java"). */
export const titleCase = (s: string) => {
  if (SPECIAL[s]) return SPECIAL[s];
  return s
    .split(" ")
    .map((w) => (UPPER.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
};
