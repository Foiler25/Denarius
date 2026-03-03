import { create } from "zustand";

interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "member";
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

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem("refresh_token"),
  user: null,
  isAuthenticated: false,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },
}));
