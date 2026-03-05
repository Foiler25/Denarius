import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  RotateCcw,
  Home,
  Landmark,
  TrendingUp,
  BarChart3,
  Settings,
  Coins,
  Wallet,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/budgets", icon: Target, label: "Budgets" },
  { to: "/recurring", icon: RotateCcw, label: "Recurring" },
  { to: "/mortgage", icon: Home, label: "Mortgage" },
  { to: "/loans", icon: Landmark, label: "Loans" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
    { to: "/networth", icon: TrendingUp, label: "Net Worth" },
];

const netWorthNavItems = [
  { to: "/accounts", icon: Wallet, label: "Asset Accounts" },
  { to: "/expense-accounts", icon: ShoppingCart, label: "Expense Accounts" },
  { to: "/categories", icon: Tag, label: "Categories" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-6 py-5">
        <Coins className="h-6 w-6 text-sidebar-primary" />
        <span className="text-xl font-bold tracking-tight">Denarius</span>
      </div>
      <div className="border-b border-sidebar-border mx-6"></div>

      <div className="flex flex-col flex-1">
        <nav className="px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-2">
          <h2 className="mb-2 px-3 text-lg font-semibold tracking-tight">
            Accounts
          </h2>
          <div className="space-y-1">
            {netWorthNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
        <nav className="mt-auto px-3 pb-4 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </div>
    </aside>
  );
}
