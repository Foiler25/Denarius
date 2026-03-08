import api from "./client";
import { useAuthStore } from "@/store/authStore";

export async function login(username: string, password: string) {
  const response = await api.post("/auth/login", { username, password });
  const { access_token, refresh_token } = response.data;
  useAuthStore.getState().setTokens(access_token, refresh_token);
  await Promise.all([getMe(), fetchSystemTimezone()]);
  return response.data;
}

export async function register(username: string, email: string, password: string) {
  const response = await api.post("/auth/register", { username, email, password });
  const { access_token, refresh_token } = response.data;
  useAuthStore.getState().setTokens(access_token, refresh_token);
  await Promise.all([getMe(), fetchSystemTimezone()]);
  return response.data;
}

export async function logout(refreshToken: string) {
  await api.post("/auth/logout", { refresh_token: refreshToken });
  useAuthStore.getState().logout();
}

export async function getMe() {
  const response = await api.get("/auth/me");
  useAuthStore.getState().setUser(response.data);
  return response.data;
}

export async function updatePreferences(
  userId: string,
  prefs: { theme_dark?: boolean; dashboard_hidden_accounts?: string[] }
) {
  await api.patch(`/users/${userId}/preferences`, prefs);
}

export async function fetchSystemTimezone() {
  const response = await api.get("/system/timezone");
  const tz: string | null = response.data.timezone;
  if (tz) {
    const { useSettingsStore } = await import("@/store/settingsStore");
    useSettingsStore.getState().setTimezoneLocal(tz);
  }
}

export async function tryRefresh(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;
  try {
    const response = await api.post("/auth/refresh", { refresh_token: refreshToken });
    const { access_token, refresh_token } = response.data;
    useAuthStore.getState().setTokens(access_token, refresh_token);
    return true;
  } catch {
    useAuthStore.getState().logout();
    return false;
  }
}
