import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export const accountsKeys = {
  all: ["accounts"] as const,
  detail: (id: string) => ["accounts", id] as const,
  transactions: (id: string) => ["accounts", id, "transactions"] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountsKeys.all,
    queryFn: () => api.get("/accounts").then((r) => r.data),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountsKeys.detail(id),
    queryFn: () => api.get(`/accounts/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/accounts", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}

export function useUpdateAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/accounts/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountsKeys.all });
      qc.invalidateQueries({ queryKey: accountsKeys.detail(id) });
    },
  });
}

export function useUpdateBalance(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (balance: number) => api.put(`/accounts/${id}/balance`, { balance }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountsKeys.all });
      qc.invalidateQueries({ queryKey: ["networth"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountsKeys.all }),
  });
}
