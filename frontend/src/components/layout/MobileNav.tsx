import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  RotateCcw,
  BarChart3,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Txns", Icon: ArrowLeftRight, end: false },
  { to: "/budgets", label: "Budgets", Icon: Target, end: false },
  { to: "/recurring", label: "Recurring", Icon: RotateCcw, end: false },
  { to: "/reports", label: "Reports", Icon: BarChart3, end: false },
];

export function MobileNav({ onOpenMore }: { onOpenMore?: () => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background border-t pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6 h-14">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground",
                isActive && "text-[var(--ea-accent)]",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
