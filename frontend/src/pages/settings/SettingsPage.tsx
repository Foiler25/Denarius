import { useState } from "react";
import { Moon, Sun, Globe } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useThemeStore } from "@/store/themeStore";
import { useSettingsStore } from "@/store/settingsStore";
import { TIMEZONES } from "@/lib/timezones";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useAccounts } from "@/api/accounts";
import { useDashboardStore } from "@/store/dashboardStore";
import { useAuthStore } from "@/store/authStore";
import api from "@/api/client";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  is_active: boolean;
  institution?: string;
  notes?: string;
  color?: string;
  linked_mortgage_id?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
}

// ---- Shared Spinner ----
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ---- Users Tab ----
function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });
}

function useUpdateUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/users/${userId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

function UsersTab() {
  const { data: users = [], isLoading, isError } = useUsers();
  const userList: User[] = Array.isArray(users) ? users : [];
  const currentUser = useAuthStore((s) => s.user);

  if (isLoading) return <Spinner />;
  if (isError) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
        Failed to load users.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{userList.length} users</p>
      {userList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No users found.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {userList.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUser?.id}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserRow({ user, isCurrentUser }: { user: User; isCurrentUser: boolean }) {
  const updateUser = useUpdateUser(user.id);
  const [roleError, setRoleError] = useState<string | null>(null);

  async function handleRoleChange(newRole: string) {
    setRoleError(null);
    try {
      await updateUser.mutateAsync({ role: newRole });
    } catch {
      setRoleError("Failed to update role.");
    }
  }

  async function handleToggleActive() {
    try {
      await updateUser.mutateAsync({ is_active: !user.is_active });
    } catch {
      // silently fail
    }
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">
        {user.username}
        {isCurrentUser && (
          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3">
        {isCurrentUser ? (
          <Badge variant="outline" className="capitalize">{user.role}</Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={user.role}
              onValueChange={handleRoleChange}
              disabled={updateUser.isPending}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            {roleError && <span className="text-xs text-destructive">{roleError}</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            user.is_active ? "border-emerald-500 text-emerald-600" : "border-muted-foreground text-muted-foreground"
          )}
        >
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {!isCurrentUser && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={handleToggleActive}
            disabled={updateUser.isPending}
          >
            {user.is_active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </td>
    </tr>
  );
}

// ---- Preferences Tab ----
function PreferencesTab() {
  const { isDark, toggle } = useThemeStore();
  const { timezone, setTimezone } = useSettingsStore();
  const { hiddenAccountIds, toggleAccount } = useDashboardStore();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const accountList: Account[] = Array.isArray(accounts) ? accounts : [];

  const [tzSearch, setTzSearch] = useState("");
  const filteredTzs = tzSearch.trim()
    ? TIMEZONES.filter((tz) =>
        tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
        tz.value.toLowerCase().includes(tzSearch.toLowerCase())
      )
    : TIMEZONES;
  const currentTzLabel = TIMEZONES.find((t) => t.value === timezone)?.label ?? timezone;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">
                  {isDark ? "Dark theme is active" : "Light theme is active"}
                </p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Date &amp; Time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Globe className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <p className="text-sm font-medium">Timezone</p>
              <p className="text-xs text-muted-foreground">
                Controls which day "today" falls on and how dates default throughout the app.
              </p>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue>{currentTzLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-1 pt-1">
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                      placeholder="Search timezones…"
                      value={tzSearch}
                      onChange={(e) => setTzSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredTzs.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No results.</div>
                  ) : (
                    filteredTzs.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Dashboard Balance Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Choose which accounts appear in the balance history chart on the dashboard.
          </p>
          {accountsLoading ? (
            <div className="py-4 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : accountList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              {accountList.map((account) => {
                const isVisible = !hiddenAccountIds.includes(account.id);
                return (
                  <div key={account.id} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                    </div>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Settings Page ----
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage preferences and users.</p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="preferences">
          <TabsList>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="mt-6">
            <PreferencesTab />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
        </Tabs>
      ) : (
        <PreferencesTab />
      )}
    </div>
  );
}
