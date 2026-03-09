import { useEffect, useState } from "react";
import { LogOut, Menu, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { logout } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  title: string;
  onMobileMenuOpen?: () => void;
}

function useClock(tz: string) {
  const format = (now: Date) => ({
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(now),
    date: new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(now),
  });

  const [clock, setClock] = useState(() => format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date())), 1000);
    return () => clearInterval(id);
  }, [tz]);

  return clock;
}

export default function Header({ title, onMobileMenuOpen }: Props) {
  const { user, refreshToken } = useAuthStore();
  const { timezone } = useSettingsStore();
  const clock = useClock(timezone);

  const handleLogout = async () => {
    if (refreshToken) {
      await logout(refreshToken);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-card px-4 sm:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden shrink-0 px-2"
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:block text-right">
          <div className="text-sm font-medium tabular-nums leading-tight">{clock.time}</div>
          <div className="text-xs text-muted-foreground leading-tight">{clock.date}</div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
