import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export function useBudgets(month?: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => api.get("/budgets", { params: month ? { month } : {} }).then((r) => r.data),
  });
}

export function useBudgetSummary(month?: string) {
  return useQuery({
    queryKey: ["budgets", "summary", month],
    queryFn: () => api.get("/budgets/summary", { params: month ? { month } : {} }).then((r) => r.data),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/budgets", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateBudget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number }) => api.put(`/budgets/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCopyMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { from_month: string; to_month: string }) =>
      api.post("/budgets/copy-month", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useMonthlyTarget(month?: string) {
  return useQuery({
    queryKey: ["budgets", "monthly-target", month],
    queryFn: () =>
      api
        .get("/budgets/monthly-target", { params: month ? { month } : {} })
        .then((r) => r.data as { month: string; amount: number } | null)
        .catch(() => null),
    enabled: !!month,
  });
}

export function useSetMonthlyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { month: string; amount: number }) =>
      api.put("/budgets/monthly-target", data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["budgets", "monthly-target", variables.month] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteMonthlyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (month: string) =>
      api.delete("/budgets/monthly-target", { params: { month } }),
    onSuccess: (_data, month) => {
      qc.invalidateQueries({ queryKey: ["budgets", "monthly-target", month] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBudgetPreferences() {
  return useQuery({
    queryKey: ["budgets", "preferences"],
    queryFn: () =>
      api.get("/budgets/preferences").then((r) => r.data as { keep_for_next_month: boolean }),
  });
}

export function useSetBudgetPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { keep_for_next_month: boolean }) =>
      api.put("/budgets/preferences", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets", "preferences"] }),
  });
}
