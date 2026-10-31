import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  filtersToQuery, get,
  type JobDetail, type JobsPage, type Market, type Meta, type ModelCard, type Overview, type Salary,
  type SkillDetail, type Skills,
} from "../lib/api";
import { useFilters } from "../lib/filters";

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: () => get<Meta>("/meta"), staleTime: Infinity });

function useFiltered<T>(key: string, path: string, extra: Record<string, string | number | undefined> = {}, enabled = true) {
  const { filters } = useFilters();
  const qs = filtersToQuery(filters, extra);
  return useQuery({
    queryKey: [key, qs],
    queryFn: () => get<T>(`${path}${qs}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export const useOverview = () => useFiltered<Overview>("overview", "/overview");
export const useMarket = () => useFiltered<Market>("market", "/market");
export const useSalary = () => useFiltered<Salary>("salary", "/salary");
export const useSkills = () => useFiltered<Skills>("skills", "/skills");
export const useSkillDetail = (name: string | null) =>
  useFiltered<SkillDetail>("skill", `/skills/${encodeURIComponent(name ?? "")}`, {}, !!name);
export const useJobs = (q: string, sort: string, page: number, pageSize = 20) =>
  useFiltered<JobsPage>("jobs", "/jobs", { q, sort, page, pageSize });
export const useJob = (id: number | null) =>
  useQuery({ queryKey: ["job", id], queryFn: () => get<JobDetail>(`/jobs/${id}`), enabled: id != null });
export const useModelCard = () =>
  useQuery({ queryKey: ["model"], queryFn: () => get<ModelCard>("/model"), staleTime: Infinity });
