import { useSyncExternalStore } from "react";
import { isEffectiveDark, usePreferencesStore } from "./preferencesStore";

interface ThemeShim {
  isDark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

function subscribe(cb: () => void) {
  return usePreferencesStore.subscribe(cb);
}

function snapshot(): ThemeShim {
  const { theme, toggleTheme, setTheme } = usePreferencesStore.getState();
  return {
    isDark: isEffectiveDark(theme),
    toggle: toggleTheme,
    setDark: (v: boolean) => setTheme(v ? "dark" : "light"),
  };
}

let cached: ThemeShim = snapshot();
let cachedTheme = usePreferencesStore.getState().theme;

function getSnapshot(): ThemeShim {
  const t = usePreferencesStore.getState().theme;
  if (t !== cachedTheme) {
    cachedTheme = t;
    cached = snapshot();
  }
  return cached;
}

export function useThemeStore(): ThemeShim;
export function useThemeStore<T>(selector: (s: ThemeShim) => T): T;
export function useThemeStore<T>(selector?: (s: ThemeShim) => T): T | ThemeShim {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector ? selector(value) : value;
}

useThemeStore.getState = (): ThemeShim => snapshot();
