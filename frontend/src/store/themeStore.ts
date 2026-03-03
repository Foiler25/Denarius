import { create } from "zustand";

function readDark(): boolean {
  try {
    const v = localStorage.getItem("denarius-dark");
    if (v === null) return true; // dark by default
    return v !== "false";
  } catch {
    return true;
  }
}

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: readDark(),
  toggle: () =>
    set((s) => {
      const next = !s.isDark;
      try { localStorage.setItem("denarius-dark", String(next)); } catch {}
      document.documentElement.classList.toggle("dark", next);
      return { isDark: next };
    }),
  setDark: (v) =>
    set(() => {
      try { localStorage.setItem("denarius-dark", String(v)); } catch {}
      document.documentElement.classList.toggle("dark", v);
      return { isDark: v };
    }),
}));
