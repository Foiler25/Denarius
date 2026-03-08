import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/accounts": "Asset Accounts",
  "/expense-accounts": "Expense Accounts",
  "/categories": "Categories",
  "/transactions": "Transactions",
  "/budgets": "Budgets",
  "/recurring": "Recurring & Subscriptions",
  "/mortgage": "Mortgage",
  "/loans": "Loans",
  "/networth": "Net Worth",
  "/reports": "Reports",
  "/settings": "Settings",
};

function getSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export default function AppShell() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? "Denarius";

  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex sticky top-0 h-dvh shrink-0">
        <Sidebar
          collapsed={collapsed}
          onToggle={handleToggle}
        />
      </div>

      {/* Mobile sidebar — Sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar mobile onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
