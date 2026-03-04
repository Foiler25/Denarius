import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarClock, TrendingUp, Wallet } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/api/dashboard";
import { useAccountBalanceHistory } from "@/api/accounts";
import { useDashboardStore } from "@/store/dashboardStore";
import { formatCurrency, formatDate, formatMonth, cn } from "@/lib/utils";

const CHART_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "12M", days: 365 },
  { label: "24M", days: 730 },
] as const;

function formatChartDate(dateStr: string, granularity: "daily" | "monthly"): string {
  if (granularity === "monthly") return formatMonth(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AccountBalancesChart() {
  const [days, setDays] = useState(365);
  const { data, isLoading } = useAccountBalanceHistory(days);
  const hiddenAccountIds = useDashboardStore((s) => s.hiddenAccountIds);

  const granularity = data?.granularity ?? "monthly";
  const visibleAccounts = (data?.accounts ?? []).filter(
    (a) => !hiddenAccountIds.includes(a.id)
  );

  const chartData = (data?.dates ?? []).map((date, idx) => {
    const point: Record<string, string | number> = { date: formatChartDate(date, granularity) };
    for (const account of visibleAccounts) {
      point[account.name] = account.balances[idx];
    }
    return point;
  });

  const xInterval = Math.max(0, Math.floor(chartData.length / 6) - 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Account Balances Over Time</CardTitle>
          <CardDescription className="text-xs">
            {visibleAccounts.length === 0
              ? "No accounts visible — update in Settings → Preferences"
              : `${visibleAccounts.length} account${visibleAccounts.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map(({ label, days: d }) => (
            <Button
              key={label}
              variant={days === d ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDays(d)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            No accounts selected. Go to{" "}
            <Link to="/settings" className="ml-1 underline underline-offset-2">
              Settings → Preferences
            </Link>{" "}
            to choose which accounts to display.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(v)
                }
                width={64}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visibleAccounts.map((account, i) => (
                <Line
                  key={account.id}
                  type="monotone"
                  dataKey={account.name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 bg-muted rounded animate-pulse mb-2" />
        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <div className="h-7 w-36 bg-muted rounded animate-pulse mb-1" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as { message?: string })?.message ?? "Unknown error";
    return (
      <div className="p-6">
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
          Failed to load dashboard: {errMsg}
        </div>
      </div>
    );
  }

  const dashboard = data as {
    net_worth: number;
    total_assets: number;
    total_liabilities: number;
    monthly_spending: number;
    monthly_budget: number;
    upcoming_bills_count: number;
    upcoming_bills: Array<{
      id: string;
      name: string;
      amount: number;
      next_due_date: string;
      days_until_due: number;
      type: string;
    }>;
    recent_transactions: Array<{
      id: string;
      date: string;
      description: string;
      category_name?: string;
      account_name?: string;
      type: string;
      amount: number;
    }>;
    over_budget_categories: Array<{
      category_name: string;
      budgeted: number;
      spent: number;
    }>;
  };

  const spendingPct =
    dashboard.monthly_budget > 0
      ? Math.min(100, (dashboard.monthly_spending / dashboard.monthly_budget) * 100)
      : 0;
  const overBudget = dashboard.monthly_spending > dashboard.monthly_budget && dashboard.monthly_budget > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your financial snapshot at a glance.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Net Worth */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                dashboard.net_worth >= 0 ? "text-emerald-600" : "text-destructive"
              )}
            >
              {formatCurrency(dashboard.net_worth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(dashboard.total_assets)} assets &minus;{" "}
              {formatCurrency(dashboard.total_liabilities)} liabilities
            </p>
          </CardContent>
        </Card>

        {/* Monthly Spending */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Spending</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", overBudget ? "text-destructive" : "text-foreground")}>
              {formatCurrency(dashboard.monthly_spending)}
            </div>
            {dashboard.monthly_budget > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  of {formatCurrency(dashboard.monthly_budget)} budgeted
                </p>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overBudget ? "bg-destructive" : "bg-emerald-500"
                    )}
                    style={{ width: `${spendingPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No budget set for this month</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Bills */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Bills</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.upcoming_bills_count}</div>
            <p className="text-xs text-muted-foreground mt-1">due in the next 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Balances Chart */}
      <AccountBalancesChart />

      {/* Over Budget Alerts */}
      {dashboard.over_budget_categories && dashboard.over_budget_categories.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-destructive text-sm">Over Budget Alerts</span>
          </div>
          <div className="space-y-2">
            {dashboard.over_budget_categories.map((cat) => (
              <div key={cat.category_name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{cat.category_name}</span>
                <span className="text-destructive">
                  {formatCurrency(cat.spent)} / {formatCurrency(cat.budgeted)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bills List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Upcoming Bills</CardTitle>
              <CardDescription className="text-xs">Next 7 days</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/recurring" className="flex items-center gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!dashboard.upcoming_bills || dashboard.upcoming_bills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming bills in the next 7 days.</p>
            ) : (
              <div className="space-y-3">
                {dashboard.upcoming_bills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{bill.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(bill.next_due_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          bill.days_until_due < 0
                            ? "border-destructive text-destructive"
                            : bill.days_until_due <= 2
                            ? "border-orange-500 text-orange-500"
                            : "border-yellow-500 text-yellow-600"
                        )}
                      >
                        {bill.days_until_due < 0
                          ? `${Math.abs(bill.days_until_due)}d overdue`
                          : bill.days_until_due === 0
                          ? "Today"
                          : `${bill.days_until_due}d`}
                      </Badge>
                      <span className="text-sm font-semibold">{formatCurrency(bill.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <CardDescription className="text-xs">Last 10 transactions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/transactions" className="flex items-center gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!dashboard.recent_transactions || dashboard.recent_transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent transactions found.</p>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{tx.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(tx.date)}
                        {tx.category_name && ` · ${tx.category_name}`}
                        {tx.account_name && ` · ${tx.account_name}`}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold ml-4 shrink-0",
                        tx.type === "income" ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
