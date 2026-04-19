import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  RotateCcw,
  TrendingUp,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Home", Icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Txns", Icon: ArrowLeftRight, end: false },
  { to: "/budgets", label: "Budgets", Icon: Target, end: false },
  { to: "/recurring", label: "Recurring", Icon: RotateCcw, end: false },
  { to: "/networth", label: "Worth", Icon: TrendingUp, end: false },
];

export function MobileNav({ onOpenMore }: { onOpenMore?: () => void }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background border-t"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="grid grid-cols-6 h-14">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] text-muted-foreground",
                isActive && "text-[var(--ea-accent)]",
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate max-w-full">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] text-muted-foreground"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="truncate max-w-full">More</span>
        </button>
      </div>
    </nav>
  );
}
