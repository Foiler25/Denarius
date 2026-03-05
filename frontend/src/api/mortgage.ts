import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";

export function useMortgage(accountId: string) {
  return useQuery({
    queryKey: ["mortgage", accountId],
    queryFn: () => api.get(`/accounts/${accountId}/mortgage`).then((r) => r.data),
    enabled: !!accountId,
  });
}

export function useAmortization(
  accountId: string,
  extraPayment?: number,
  enabled = true
) {
  return useQuery({
    queryKey: ["mortgage", accountId, "amortization", extraPayment],
    queryFn: () =>
      api
        .get(`/accounts/${accountId}/mortgage/amortization`, {
          params:
            extraPayment !== undefined ? { extra_payment: extraPayment } : {},
        })
        .then((r) => r.data),
    enabled: !!accountId && enabled,
  });
}

export function useRemainingAmortization(
  accountId: string,
  extraPayment?: number,
  enabled = true
) {
  return useQuery({
    queryKey: ["mortgage", accountId, "amortization", "remaining", extraPayment],
    queryFn: () =>
      api
        .get(`/accounts/${accountId}/mortgage/amortization`, {
          params: {
            from_current_balance: true,
            ...(extraPayment !== undefined ? { extra_payment: extraPayment } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!accountId && enabled,
  });
}

export function useCreateMortgage(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/accounts/${accountId}/mortgage`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mortgage", accountId] }),
  });
}

export function useUpdateMortgage(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/accounts/${accountId}/mortgage`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mortgage", accountId] }),
  });
}

export function useRecordMortgagePayment(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      source_account_id: string;
      source_amount: number;
      mortgage_amount: number;
      date: string;
      description?: string;
    }) =>
      api
        .post(`/accounts/${accountId}/mortgage/record-payment`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["mortgage", accountId, "amortization", "remaining"] });
      qc.invalidateQueries({ queryKey: ["networth"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useExtraPaymentCalc(accountId: string) {
  return useMutation({
    mutationFn: (extraMonthly: number) =>
      api
        .post(`/accounts/${accountId}/mortgage/extra-payment-calc`, { extra_monthly: extraMonthly })
        .then((r) => r.data),
  });
}
