import { LogOut, Menu, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
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

export default function Header({ title, onMobileMenuOpen }: Props) {
  const { user, refreshToken } = useAuthStore();

  const handleLogout = async () => {
    if (refreshToken) {
      await logout(refreshToken);
    }
  };

  return (
    <header className="h-14 border-b bg-card px-4 sm:px-6 flex items-center justify-between gap-3">
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 shrink-0">
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
    </header>
  );
}
