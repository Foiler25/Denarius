import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/budgets": "Budgets",
  "/recurring": "Recurring & Subscriptions",
  "/mortgage": "Mortgage",
  "/networth": "Net Worth",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function AppShell() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? "Denarius";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
