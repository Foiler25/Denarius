import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export function useRecurring(type?: string, isActive: boolean = true) {
  return useQuery({
    queryKey: ["recurring", type, isActive],
    queryFn: () =>
      api.get("/recurring", { params: { ...(type ? { type } : {}), is_active: isActive } }).then((r) => r.data),
  });
}

export function useUpcomingRecurring(days: number = 30) {
  return useQuery({
    queryKey: ["recurring", "upcoming", days],
    queryFn: () => api.get("/recurring/upcoming", { params: { days } }).then((r) => r.data),
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/recurring", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useUpdateRecurring(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/recurring/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: string; date?: string; amount?: number }) =>
      api.post(`/recurring/${id}/mark-paid`, { date, amount }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
