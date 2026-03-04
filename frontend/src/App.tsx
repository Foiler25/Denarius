import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TransactionsPage from "@/pages/TransactionsPage";
import BudgetsPage from "@/pages/BudgetsPage";
import RecurringPage from "@/pages/RecurringPage";
import MortgagePage from "@/pages/MortgagePage";
import LoanPage from "@/pages/LoanPage";
import NetWorthPage from "@/pages/NetWorthPage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/settings/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/mortgage" element={<MortgagePage />} />
          <Route path="/loans" element={<LoanPage />} />
          <Route path="/networth" element={<NetWorthPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
