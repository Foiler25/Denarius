import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export const expenseAccountsKeys = {
  all: ["expense-accounts"] as const,
  detail: (id: string) => ["expense-accounts", id] as const,
};

export interface ExpenseAccountOut {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useExpenseAccounts() {
  return useQuery<ExpenseAccountOut[]>({
    queryKey: expenseAccountsKeys.all,
    queryFn: () => api.get("/expense-accounts").then((r) => r.data),
  });
}

export function useCreateExpenseAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/expense-accounts", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseAccountsKeys.all }),
  });
}

export function useUpdateExpenseAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/expense-accounts/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseAccountsKeys.all });
      qc.invalidateQueries({ queryKey: expenseAccountsKeys.detail(id) });
    },
  });
}

export function useDeleteExpenseAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/expense-accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: expenseAccountsKeys.all }),
  });
}
