import { useQuery } from "@tanstack/react-query";
import api from "./client";

export function useSpendingByCategory(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ["reports", "spending-by-category", params],
    queryFn: () => api.get("/reports/spending-by-category", { params }).then((r) => r.data),
  });
}

export function useIncomeVsExpense(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ["reports", "income-vs-expense", params],
    queryFn: () => api.get("/reports/income-vs-expense", { params }).then((r) => r.data),
  });
}

export function useMonthlyTrend(months: number = 12, categoryId?: string) {
  return useQuery({
    queryKey: ["reports", "monthly-trend", months, categoryId],
    queryFn: () =>
      api.get("/reports/monthly-trend", { params: { months, ...(categoryId ? { category_id: categoryId } : {}) } }).then((r) => r.data),
  });
}

export function useCashFlow(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ["reports", "cash-flow", params],
    queryFn: () => api.get("/reports/cash-flow", { params }).then((r) => r.data),
  });
}
