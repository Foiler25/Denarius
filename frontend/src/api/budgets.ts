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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useUpdateBudget(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number }) => api.put(`/budgets/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useCopyMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { from_month: string; to_month: string }) =>
      api.post("/budgets/copy-month", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}
