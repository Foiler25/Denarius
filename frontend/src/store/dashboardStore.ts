import { create } from "zustand";

const STORAGE_KEY = "denarius-chart-hidden-accounts";

function readHiddenAccounts(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return [];
    return JSON.parse(v);
  } catch {
    return [];
  }
}

interface DashboardState {
  hiddenAccountIds: string[];
  toggleAccount: (id: string) => void;
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
      return { hiddenAccountIds: next };
    }),
}));
