import { create } from "zustand";
import { persist } from "zustand/middleware";
import { updatePreferences } from "@/api/auth";
import { useAuthStore } from "./authStore";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "gold" | "rose" | "sky" | "emerald" | "violet";
export type SidebarStyle = "default" | "minimal" | "floating";
export type Density = "comfortable" | "compact" | "spacious";

export interface UserPreferences {
  theme: ThemeMode;
  accentColor: AccentColor;
  sidebarStyle: SidebarStyle;
  density: Density;
  sidebarCollapsed: boolean;
}

interface PreferencesState extends UserPreferences {
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setAccent: (c: AccentColor) => void;
  setDensity: (d: Density) => void;
  setSidebarStyle: (s: SidebarStyle) => void;
  setSidebarCollapsed: (b: boolean) => void;
  hydrateFromUser: (themeDark: boolean | null | undefined) => void;
}

const DEFAULT: UserPreferences = {
  theme: "dark",
  accentColor: "blue",
  sidebarStyle: "default",
  density: "comfortable",
  sidebarCollapsed: false,
};

export function isEffectiveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyPreferencesToDOM(prefs: UserPreferences) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("dark", isEffectiveDark(prefs.theme));
  html.setAttribute("data-accent", prefs.accentColor);
  html.setAttribute("data-density", prefs.density);
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULT,
      setTheme: (theme) => {
        set({ theme });
        applyPreferencesToDOM({ ...get(), theme });
        const user = useAuthStore.getState().user;
        if (user) updatePreferences(user.id, { theme_dark: isEffectiveDark(theme) });
      },
      toggleTheme: () => {
        const next: ThemeMode = isEffectiveDark(get().theme) ? "light" : "dark";
        get().setTheme(next);
      },
      setAccent: (accentColor) => {
        set({ accentColor });
        applyPreferencesToDOM({ ...get(), accentColor });
      },
      setDensity: (density) => {
        set({ density });
        applyPreferencesToDOM({ ...get(), density });
      },
      setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      hydrateFromUser: (themeDark) => {
        if (themeDark == null) return;
        const theme: ThemeMode = themeDark ? "dark" : "light";
        set({ theme });
        applyPreferencesToDOM({ ...get(), theme });
      },
    }),
    { name: "denarius-preferences" },
  ),
);
