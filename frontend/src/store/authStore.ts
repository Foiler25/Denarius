import { create } from "zustand";
import { usePreferencesStore } from "./preferencesStore";
import { useDashboardStore } from "./dashboardStore";

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "member";
  theme_dark?: boolean | null;
  dashboard_hidden_accounts?: string[] | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

function applyUserPreferences(user: User) {
  usePreferencesStore.getState().hydrateFromUser(user.theme_dark);
  if (user.dashboard_hidden_accounts != null) {
    useDashboardStore.getState().setHiddenAccounts(user.dashboard_hidden_accounts);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem("refresh_token"),
  user: null,
  isAuthenticated: false,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
  setUser: (user) => {
    applyUserPreferences(user);
    set({ user });
  },
  logout: () => {
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },
}));
