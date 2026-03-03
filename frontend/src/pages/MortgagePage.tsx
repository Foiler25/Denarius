import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
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
import { useAccounts } from "@/api/accounts";
import { useMortgage, useAmortization, useExtraPaymentCalc } from "@/api/mortgage";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
}

// Matches MortgageOut from the backend
interface MortgageData {
  original_principal: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  extra_payment: number;
}

// Matches AmortizationRow from the backend
interface AmortizationRow {
  payment_number: number;
  payment_date: string;
  payment_amount: number;
  principal: number;
  interest: number;
  balance: number;
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
  const { data: accounts = [] } = useAccounts();
  const mortgageAccounts = (accounts as Account[]).filter(
    (a) => a.type === "mortgage" || a.type === "loan"
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const accountId = selectedAccountId || (mortgageAccounts[0]?.id ?? "");

  // Extra payment calc
  const [extraInput, setExtraInput] = useState("");
  const [calcResult, setCalcResult] = useState<ExtraPaymentResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const extraCalc = useExtraPaymentCalc(accountId);

  const [showAllRows, setShowAllRows] = useState(false);

  const { data: mortgage, isLoading: mortLoading, isError: mortError } = useMortgage(accountId);
  // Pass extra_payment=0 so the schedule shows the standard baseline amortization
  const { data: amortizationData, isLoading: amorLoading } = useAmortization(accountId, 0);

  const mortgageInfo: MortgageData | null = mortgage ?? null;
  const allRows: AmortizationRow[] = Array.isArray(amortizationData) ? amortizationData : [];
  const selectedAccount = (accounts as Account[]).find((a) => a.id === accountId);
  const standardMonthlyPayment = allRows[0]?.payment_amount;
  const displayedRows = showAllRows ? allRows : allRows.slice(0, 12);

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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mortgage / Loan</h1>
        <p className="text-muted-foreground text-sm">Amortization details and extra payment analysis.</p>
      </div>

      {/* Account Selector */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Loan Account</Label>
        {mortgageAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mortgage or loan accounts found. Add one in Settings.
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
          {/* Key Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Original Principal"
              value={formatCurrency(mortgageInfo.original_principal)}
              sub={`Started ${formatDate(mortgageInfo.start_date)}`}
            />
            <StatCard
              label="Current Balance"
              value={selectedAccount ? formatCurrency(selectedAccount.current_balance) : "—"}
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
                allRows.length > 0
                  ? `Payoff ~${formatDate(allRows[allRows.length - 1].payment_date)}`
                  : undefined
              }
            />
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

          {/* Amortization Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Amortization Schedule</CardTitle>
                  <CardDescription className="text-xs">
                    {showAllRows ? `All ${allRows.length} payments` : "First 12 payments"}
                  </CardDescription>
                </div>
                {allRows.length > 12 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-xs"
                    onClick={() => setShowAllRows((v) => !v)}
                  >
                    {showAllRows ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        View All ({allRows.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {amorLoading ? (
                <Spinner />
              ) : allRows.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                  Amortization schedule not available.
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
                  {!showAllRows && allRows.length > 12 && (
                    <div className="px-4 py-3 border-t text-center">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAllRows(true)}>
                        Show all {allRows.length} payments
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
