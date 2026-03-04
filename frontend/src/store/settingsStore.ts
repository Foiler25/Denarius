import { create } from "zustand";

const STORAGE_KEY = "denarius-settings";

function readTimezone(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.timezone === "string" && parsed.timezone) {
        return parsed.timezone;
      }
    }
  } catch {}
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function writeTimezone(tz: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, timezone: tz }));
  } catch {}
}

interface SettingsState {
  timezone: string;
  setTimezone: (tz: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  timezone: readTimezone(),
  setTimezone: (tz) =>
    set(() => {
      writeTimezone(tz);
      return { timezone: tz };
    }),
}));
