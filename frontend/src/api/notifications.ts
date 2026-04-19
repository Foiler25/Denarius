import { useDashboard } from "./dashboard";

export type NotificationSeverity = "info" | "warning" | "danger";

export interface Notification {
  id: string;
  title: string;
  subtitle?: string;
  severity: NotificationSeverity;
  link: string;
}

interface DashboardShape {
  upcoming_bills?: Array<{
    id: string;
    name: string;
    amount: number;
    next_due_date: string;
    days_until_due: number;
    type: string;
  }>;
  over_budget_alerts?: Array<{
    id: number | string;
    category: { name: string } | null;
    amount: number;
    actual_spent: number;
  }>;
}

export function useNotifications() {
  const { data } = useDashboard();
  const dashboard = (data ?? {}) as DashboardShape;

  const items: Notification[] = [];

  for (const bill of dashboard.upcoming_bills ?? []) {
    if (bill.days_until_due <= 3 && bill.days_until_due >= 0) {
      const when =
        bill.days_until_due === 0
          ? "due today"
          : bill.days_until_due === 1
            ? "due tomorrow"
            : `due in ${bill.days_until_due} days`;
      items.push({
        id: `bill-${bill.id}`,
        title: bill.name,
        subtitle: `${when} · $${Number(bill.amount).toFixed(2)}`,
        severity: bill.days_until_due === 0 ? "danger" : "warning",
        link: "/recurring",
      });
    }
  }

  for (const alert of dashboard.over_budget_alerts ?? []) {
    items.push({
      id: `budget-${alert.id}`,
      title: `${alert.category?.name ?? "Budget"} over limit`,
      subtitle: `Spent $${Number(alert.actual_spent).toFixed(2)} of $${Number(alert.amount).toFixed(2)}`,
      severity: "danger",
      link: "/budgets",
    });
  }

  return { items, count: items.length };
}
