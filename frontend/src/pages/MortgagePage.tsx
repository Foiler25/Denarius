import { useState } from "react";
import { Calculator, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAccounts } from "@/api/accounts";
import { useMortgage, useAmortization, useRemainingAmortization, useExtraPaymentCalc, useRecordMortgagePayment } from "@/api/mortgage";
import { formatCurrency, formatDate, todayString, cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
}

interface MortgageData {
  original_principal: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  extra_payment: number;
}

interface AmortizationRow {
  payment_number: number;
  payment_date: string;
  payment_amount: number;
  principal: number;
  interest: number;
  balance: number;
  cumulative_interest: number;
}

interface ExtraPaymentResult {
  months_saved: number;
  interest_saved: number;
  new_payoff_date: string;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function MortgagePage() {
  const { timezone } = useSettingsStore();
  const { data: accounts = [] } = useAccounts();
  const mortgageAccounts = (accounts as Account[]).filter((a) => a.type === "mortgage");

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const accountId = selectedAccountId || (mortgageAccounts[0]?.id ?? "");

  // Extra payment calc
  const [extraInput, setExtraInput] = useState("");
  const [calcResult, setCalcResult] = useState<ExtraPaymentResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const extraCalc = useExtraPaymentCalc(accountId);

  // Amortization view mode
  type ViewMode = "next12" | "all";
  const [viewMode, setViewMode] = useState<ViewMode>("next12");

  // Record payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogTab, setPaymentDialogTab] = useState<"monthly" | "extra">("monthly");
  const [principalOverride, setPrincipalOverride] = useState("");
  const [extraPaymentAmount, setExtraPaymentAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [recordError, setRecordError] = useState<string | null>(null);
  const recordPayment = useRecordMortgagePayment(accountId);

  const { data: mortgage, isLoading: mortLoading, isError: mortError } = useMortgage(accountId);
  const { data: amortizationData, isLoading: amorLoading } = useAmortization(
    accountId,
    mortgage?.extra_payment,
    !!mortgage
  );
  const { data: remainingData, isLoading: remainingLoading } = useRemainingAmortization(
    accountId,
    mortgage?.extra_payment,
    !!mortgage
  );

  const mortgageInfo: MortgageData | null = mortgage ?? null;
  const allRows: AmortizationRow[] = Array.isArray(amortizationData) ? amortizationData : [];
  const remainingRows: AmortizationRow[] = Array.isArray(remainingData) ? remainingData : [];
  const selectedAccount = (accounts as Account[]).find((a) => a.id === accountId);
  const standardMonthlyPayment = allRows[0]?.payment_amount;

  const today = todayString(timezone);

  // Remaining schedule display
  const nextRemainingIdx = remainingRows.findIndex((row) => row.payment_date >= today);
  const nextRemainingStart = nextRemainingIdx === -1 ? 0 : nextRemainingIdx;
  const displayedRows =
    viewMode === "all"
      ? remainingRows
      : remainingRows.slice(nextRemainingStart, nextRemainingStart + 12);

  // Payments to date (from original schedule for interest approximation)
  const paidRows = allRows.filter((row) => row.payment_date < today);
  const lastPaidRow = paidRows.at(-1);

  // Current balance from account (transaction-based, source of truth)
  const displayedBalance = selectedAccount
    ? Math.abs(selectedAccount.current_balance)
    : mortgageInfo?.original_principal;

  // Totals for payments to date
  const totalPrincipalPaid =
    mortgageInfo && selectedAccount
      ? mortgageInfo.original_principal - Math.abs(selectedAccount.current_balance)
      : 0;
  const totalInterestPaid = lastPaidRow?.cumulative_interest ?? 0;

  // Current month's scheduled payment (for Record Monthly Payment dialog)
  const currentMonthRow = allRows.find((row) => row.payment_date >= today);

  async function handleCalc(e: React.FormEvent) {
    e.preventDefault();
    setCalcError(null);
    setCalcResult(null);
    const val = parseFloat(extraInput);
    if (isNaN(val) || val < 0) { setCalcError("Enter a valid amount (0 or more)."); return; }
    try {
      const result = await extraCalc.mutateAsync(val);
      setCalcResult(result);
    } catch {
      setCalcError("Failed to calculate. Ensure mortgage details are configured.");
    }
  }

  const sourceAccounts = (accounts as Account[]).filter((a) => a.type !== "mortgage");

  function openPaymentDialog(tab: "monthly" | "extra") {
    setPaymentDialogTab(tab);
    setRecordError(null);
    setPrincipalOverride(currentMonthRow ? String(currentMonthRow.principal) : "");
    setExtraPaymentAmount("");
    setSourceAccountId(sourceAccounts[0]?.id ?? "");
    setPaymentDialogOpen(true);
  }

  async function handleRecordPayment() {
    setRecordError(null);
    if (!sourceAccountId) {
      setRecordError("Select a source account.");
      return;
    }
    try {
      if (paymentDialogTab === "monthly") {
        const principal = parseFloat(principalOverride);
        if (isNaN(principal) || principal <= 0) {
          setRecordError("Enter a valid principal amount.");
          return;
        }
        const sourceAmount = currentMonthRow?.payment_amount ?? principal;
        await recordPayment.mutateAsync({
          source_account_id: sourceAccountId,
          source_amount: sourceAmount,
          mortgage_amount: principal,
          date: today,
          description: currentMonthRow
            ? `Mortgage payment (Payment #${currentMonthRow.payment_number})`
            : "Mortgage payment",
        });
      } else {
        const amount = parseFloat(extraPaymentAmount);
        if (isNaN(amount) || amount <= 0) {
          setRecordError("Enter a valid extra payment amount.");
          return;
        }
        await recordPayment.mutateAsync({
          source_account_id: sourceAccountId,
          source_amount: amount,
          mortgage_amount: amount,
          date: today,
          description: "Extra mortgage payment",
        });
      }
      setPaymentDialogOpen(false);
    } catch {
      setRecordError("Failed to record payment. Please try again.");
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mortgage</h1>
        <p className="text-muted-foreground text-sm">Amortization details and extra payment analysis.</p>
      </div>

      {/* Account Selector */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Mortgage Account</Label>
        {mortgageAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mortgage accounts found. Add one in Settings.
          </p>
        ) : (
          <Select value={accountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select account…" />
            </SelectTrigger>
            <SelectContent>
              {mortgageAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!accountId ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Select a loan account to view details.
        </div>
      ) : mortLoading ? (
        <Spinner />
      ) : mortError || !mortgageInfo ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
          No mortgage details found for this account. Please configure them in Settings.
        </div>
      ) : (
        <>
          {/* Key Stats + Record Payment button */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <StatCard
                label="Original Principal"
                value={formatCurrency(mortgageInfo.original_principal)}
                sub={`Started ${formatDate(mortgageInfo.start_date)}`}
              />
              <StatCard
                label="Current Balance"
                value={displayedBalance !== undefined ? formatCurrency(displayedBalance) : "—"}
                sub={`${mortgageInfo.term_months} month term`}
              />
              <StatCard
                label="Interest Rate"
                value={`${mortgageInfo.interest_rate}%`}
                sub="Annual rate"
              />
              <StatCard
                label="Monthly Payment"
                value={standardMonthlyPayment !== undefined ? formatCurrency(standardMonthlyPayment) : "—"}
                sub={
                  remainingRows.length > 0
                    ? `Payoff ~${formatDate(remainingRows[remainingRows.length - 1].payment_date)}`
                    : allRows.length > 0
                    ? `Payoff ~${formatDate(allRows[allRows.length - 1].payment_date)}`
                    : undefined
                }
              />
            </div>
            <div className="flex gap-2 sm:pt-0 sm:self-start">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openPaymentDialog("monthly")}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Record Payment
              </Button>
            </div>
          </div>

          {/* Extra Payment Calculator */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Extra Payment Calculator</CardTitle>
              </div>
              <CardDescription className="text-xs">
                See how much you can save by adding extra monthly payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCalc} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Extra Monthly Payment ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-40"
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={extraCalc.isPending}>
                  {extraCalc.isPending ? "Calculating…" : "Calculate"}
                </Button>
              </form>
              {calcError && (
                <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {calcError}
                </div>
              )}
              {calcResult && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Months Saved</p>
                    <p className="text-2xl font-bold text-emerald-600">{calcResult.months_saved}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Interest Saved</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calcResult.interest_saved)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground mb-1">New Payoff Date</p>
                    <p className="text-lg font-bold">{formatDate(calcResult.new_payoff_date)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Tabs */}
          <Tabs defaultValue="payments-to-date">
            <TabsList>
              <TabsTrigger value="payments-to-date">Payments to Date</TabsTrigger>
              <TabsTrigger value="amortization">Amortization Schedule</TabsTrigger>
            </TabsList>

            {/* Payments to Date */}
            <TabsContent value="payments-to-date">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payments to Date</CardTitle>
                  <CardDescription className="text-xs">
                    {paidRows.length > 0
                      ? `${paidRows.length} payment${paidRows.length !== 1 ? "s" : ""} made since ${formatDate(paidRows[0].payment_date)}`
                      : "No payments made yet."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {amorLoading ? (
                    <Spinner />
                  ) : paidRows.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                      No payments have been made yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Principal</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Interest</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paidRows.map((row) => (
                            <tr
                              key={row.payment_number}
                              className={cn(
                                "border-b last:border-0 hover:bg-muted/30",
                                row.payment_number % 12 === 0 && "bg-muted/20"
                              )}
                            >
                              <td className="px-4 py-2.5 text-muted-foreground">{row.payment_number}</td>
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(row.payment_date)}</td>
                              <td className="px-4 py-2.5 text-right text-emerald-700">{formatCurrency(row.principal)}</td>
                              <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(row.interest)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-muted/40">
                            <td colSpan={2} className="px-4 py-3 font-semibold text-sm">Total Paid</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(totalPrincipalPaid)}</td>
                            <td className="px-4 py-3 text-right font-bold text-destructive">{formatCurrency(totalInterestPaid)}</td>
                            <td className="px-4 py-3 text-right font-bold">{displayedBalance !== undefined ? formatCurrency(displayedBalance) : "—"}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Amortization Schedule (remaining, from current balance) */}
            <TabsContent value="amortization">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Amortization Schedule</CardTitle>
                      <CardDescription className="text-xs">
                        {viewMode === "all"
                          ? `Remaining ${remainingRows.length} payments from current balance`
                          : "Next 12 remaining payments from current balance"}
                      </CardDescription>
                    </div>
                    {remainingRows.length > 12 && (
                      <div className="flex items-center rounded-md border overflow-hidden">
                        {(["next12", "all"] as ViewMode[]).map((mode, i) => (
                          <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={cn(
                              "px-2.5 py-1 text-xs transition-colors",
                              i > 0 && "border-l",
                              viewMode === mode
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {mode === "next12" ? "Next 12" : `All (${remainingRows.length})`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {remainingLoading ? (
                    <Spinner />
                  ) : remainingRows.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                      {displayedBalance === 0
                        ? "Loan is fully paid off."
                        : "Amortization schedule not available."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Payment</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Principal</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Interest</th>
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRows.map((row) => (
                            <tr
                              key={row.payment_number}
                              className={cn(
                                "border-b last:border-0 hover:bg-muted/30",
                                row.payment_number % 12 === 0 && "bg-muted/20"
                              )}
                            >
                              <td className="px-4 py-2.5 text-muted-foreground">{row.payment_number}</td>
                              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(row.payment_date)}</td>
                              <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.payment_amount)}</td>
                              <td className="px-4 py-2.5 text-right text-emerald-700">{formatCurrency(row.principal)}</td>
                              <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(row.interest)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Record Payment Dialog */}
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Mortgage Payment</DialogTitle>
              </DialogHeader>

              <Tabs value={paymentDialogTab} onValueChange={(v) => {
                setPaymentDialogTab(v as "monthly" | "extra");
                setRecordError(null);
              }}>
                <TabsList className="w-full">
                  <TabsTrigger value="monthly" className="flex-1">Monthly Payment</TabsTrigger>
                  <TabsTrigger value="extra" className="flex-1">Extra Payment</TabsTrigger>
                </TabsList>

                {/* Monthly Payment Tab */}
                <TabsContent value="monthly" className="space-y-4 pt-2">
                  {currentMonthRow ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scheduled payment</span>
                        <span className="font-medium">{formatCurrency(currentMonthRow.payment_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interest portion</span>
                        <span className="text-destructive">{formatCurrency(currentMonthRow.interest)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1.5">
                        <span className="text-muted-foreground">Principal to record</span>
                        <span className="text-emerald-700 font-semibold">{formatCurrency(currentMonthRow.principal)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming payment found in schedule.</p>
                  )}
                  <div className="space-y-1">
                    <Label>Pay from Account</Label>
                    <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Full payment ({currentMonthRow ? formatCurrency(currentMonthRow.payment_amount) : "scheduled amount"}) will be deducted from this account.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="principal-input">Principal Amount ($)</Label>
                    <Input
                      id="principal-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={principalOverride}
                      onChange={(e) => setPrincipalOverride(e.target.value)}
                      placeholder={currentMonthRow ? String(currentMonthRow.principal) : "0.00"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only the principal portion reduces your mortgage balance.
                    </p>
                  </div>
                </TabsContent>

                {/* Extra Payment Tab */}
                <TabsContent value="extra" className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Record a lump-sum extra payment toward principal. This reduces your remaining balance and shortens your loan term.
                  </p>
                  <div className="space-y-1">
                    <Label>Pay from Account</Label>
                    <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="extra-amount-input">Extra Payment Amount ($)</Label>
                    <Input
                      id="extra-amount-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={extraPaymentAmount}
                      onChange={(e) => setExtraPaymentAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Full amount will be deducted from the source account and applied to principal.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {recordError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {recordError}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                  {recordPayment.isPending ? "Recording…" : "Record Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
