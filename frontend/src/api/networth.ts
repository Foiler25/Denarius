import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export function useNetWorthCurrent() {
  return useQuery({
    queryKey: ["networth", "current"],
    queryFn: () => api.get("/networth/current").then((r) => r.data),
  });
}

export function useNetWorthHistory(months: number = 12) {
  return useQuery({
    queryKey: ["networth", "history", months],
    queryFn: () => api.get("/networth/history", { params: { months } }).then((r) => r.data),
  });
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => api.post("/networth/snapshot", null, { params: date ? { snapshot_date: date } : {} }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["networth"] }),
  });
}
