import { create } from "zustand";
import { updatePreferences } from "@/api/auth";
import { useAuthStore } from "./authStore";

const STORAGE_KEY = "denarius-chart-hidden-accounts";
const DISMISSED_ALERTS_KEY = "denarius-dismissed-budget-alerts";

function readHiddenAccounts(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return [];
    return JSON.parse(v);
  } catch {
    return [];
  }
}

function readDismissedAlerts(): string[] {
  try {
    const v = localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (!v) return [];
    return JSON.parse(v);
  } catch {
    return [];
  }
}

interface DashboardState {
  hiddenAccountIds: string[];
  toggleAccount: (id: string) => void;
  setHiddenAccounts: (ids: string[]) => void;
  dismissedBudgetAlerts: string[];
  dismissBudgetAlert: (id: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  hiddenAccountIds: readHiddenAccounts(),
  toggleAccount: (id) =>
    set((s) => {
      const next = s.hiddenAccountIds.includes(id)
        ? s.hiddenAccountIds.filter((x) => x !== id)
        : [...s.hiddenAccountIds, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      const user = useAuthStore.getState().user;
      if (user) updatePreferences(user.id, { dashboard_hidden_accounts: next });
      return { hiddenAccountIds: next };
    }),
  setHiddenAccounts: (ids) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
    set({ hiddenAccountIds: ids });
  },
  dismissedBudgetAlerts: readDismissedAlerts(),
  dismissBudgetAlert: (id) =>
    set((s) => {
      const month = new Date().toISOString().slice(0, 7);
      const key = `${month}:${id}`;
      if (s.dismissedBudgetAlerts.includes(key)) return s;
      const next = [...s.dismissedBudgetAlerts, key];
      try {
        localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(next));
      } catch {}
      return { dismissedBudgetAlerts: next };
    }),
}));
