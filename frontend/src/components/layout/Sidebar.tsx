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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const accountNavItems = [
  { to: "/accounts", icon: Wallet, label: "Asset Accounts" },
  { to: "/expense-accounts", icon: ShoppingCart, label: "Expense Accounts" },
  { to: "/categories", icon: Tag, label: "Categories" },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
  onClose?: () => void;
}

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "w-full flex items-center py-2 rounded-md text-sm font-medium transition-colors",
          collapsed ? "justify-center px-2" : "gap-3 px-3",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center justify-center">
              <Icon className="h-4 w-4 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ) : (
        <>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggle,
  mobile = false,
  onClose,
}: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Branding */}
        <div
          className={cn(
            "h-14 flex items-center gap-2 border-b border-sidebar-border shrink-0",
            collapsed ? "justify-center px-2" : "px-6"
          )}
        >
          <Coins className="h-6 w-6 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight">Denarius</span>
          )}
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Primary nav */}
          <nav className="px-2 py-4 space-y-1">
            {navItems.map(({ to, icon, label }) => (
              <NavItem
                key={to}
                to={to}
                icon={icon}
                label={label}
                collapsed={collapsed}
                onClick={mobile ? onClose : undefined}
              />
            ))}
          </nav>

          {/* Accounts section */}
          <div className="px-2 py-2">
            {!collapsed && (
              <h2 className="mb-2 px-3 text-lg font-semibold tracking-tight">
                Accounts
              </h2>
            )}
            {collapsed && <div className="border-t border-sidebar-border mb-2" />}
            <div className="space-y-1">
              {accountNavItems.map(({ to, icon, label }) => (
                <NavItem
                  key={to}
                  to={to}
                  icon={icon}
                  label={label}
                  collapsed={collapsed}
                  onClick={mobile ? onClose : undefined}
                />
              ))}
            </div>
          </div>

          {/* Bottom: Settings + collapse toggle */}
          <nav className="mt-auto px-2 pb-2 space-y-1">
            <NavItem
              to="/settings"
              icon={Settings}
              label="Settings"
              collapsed={collapsed}
              onClick={mobile ? onClose : undefined}
            />

            {/* Desktop collapse toggle — hidden on mobile */}
            {!mobile && onToggle && (
              <button
                onClick={onToggle}
                className={cn(
                  "w-full flex items-center py-2 rounded-md text-sm font-medium transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed ? "justify-center px-2" : "gap-3 px-3"
                )}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            )}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}
