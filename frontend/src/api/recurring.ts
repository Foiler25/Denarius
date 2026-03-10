import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import api from "./client";

// Immediately patch all type-filtered recurring caches with an updated item.
// Uses predicate matching to avoid relying on fuzzy key behaviour across TQ versions.
function patchRecurringItem(qc: QueryClient, updatedItem: { id: string }) {
  qc.setQueriesData(
    {
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "recurring" &&
        query.queryKey[1] !== "upcoming",
    },
    (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((item: { id: string }) =>
        item.id === updatedItem.id ? updatedItem : item
      );
    }
  );
}

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
    onSuccess: async (updatedItem) => {
      patchRecurringItem(qc, updatedItem);
      await qc.refetchQueries({ queryKey: ["recurring"] });
    },
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
    mutationFn: ({
      id, date, amount, description, account_id, category_id, source_account_id,
    }: {
      id: string;
      date?: string;
      amount?: number;
      description?: string;
      account_id?: string;
      category_id?: string | null;
      source_account_id?: string;
    }) =>
      api.post(`/recurring/${id}/mark-paid`, { date, amount, description, account_id, category_id, source_account_id }).then((r) => r.data),
    onSuccess: (updatedItem) => {
      patchRecurringItem(qc, updatedItem);
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["mortgage"] });
    },
  });
}

export function useMarkPaidNoTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: string; date?: string; amount?: number }) =>
      api.post(`/recurring/${id}/mark-paid-no-transaction`, { date, amount }).then((r) => r.data),
    onSuccess: (updatedItem) => {
      patchRecurringItem(qc, updatedItem);
      qc.invalidateQueries({ queryKey: ["recurring"] });
    },
  });
}
