import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Skeleton } from "./components/ui";
import { FilterProvider } from "./lib/filters";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

const Overview = lazy(() => import("./pages/Overview"));
const Market = lazy(() => import("./pages/Market"));
const Salary = lazy(() => import("./pages/Salary"));
const Skills = lazy(() => import("./pages/Skills"));
const Predictor = lazy(() => import("./pages/Predictor"));
const Jobs = lazy(() => import("./pages/Jobs"));

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <BrowserRouter>
          <FilterProvider>
            <Layout>
              <Suspense fallback={<Skeleton h={600} />}>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/market" element={<Market />} />
                  <Route path="/salary" element={<Salary />} />
                  <Route path="/skills" element={<Skills />} />
                  <Route path="/predict" element={<Predictor />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </FilterProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
