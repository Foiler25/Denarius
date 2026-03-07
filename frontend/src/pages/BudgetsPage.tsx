import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Copy, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useBudgets,
  useBudgetSummary,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useCopyMonth,
} from "@/api/budgets";
import { useCategories } from "@/api/categories";
import { formatCurrency, formatMonth, currentMonthParam, cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

// ---- localStorage helpers ----

function getTotalBudgets(): Record<string, number> {
  try {
    const v = localStorage.getItem("denarius-total-budgets");
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

function saveTotalBudget(month: string, amount: number | null) {
  const all = getTotalBudgets();
  if (amount === null) {
    delete all[month];
  } else {
    all[month] = amount;
  }
  try { localStorage.setItem("denarius-total-budgets", JSON.stringify(all)); } catch {}
}

function getKeepBudgetPref(): boolean {
  try { return localStorage.getItem("denarius-budget-keep") === "true"; } catch { return false; }
}

function saveKeepBudgetPref(v: boolean) {
  try { localStorage.setItem("denarius-budget-keep", String(v)); } catch {}
}

// ---- Types ----

interface Budget {
  id: string;
  category_id: string;
  category: { id: string; name: string; color: string; icon?: string | null } | null;
  amount: number;
  actual_spent: number;
  month: string;
}

interface BudgetSummary {
  total_budgeted: number;
  total_spent: number;
  over_budget_count: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

// ---- Helpers ----

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ---- Main Page ----

export default function BudgetsPage() {
  const { timezone } = useSettingsStore();

  const [month, setMonth] = useState<string>(() => currentMonthParam(useSettingsStore.getState().timezone));

  // Total budget (per-month, localStorage)
  const [totalBudget, setTotalBudgetState] = useState<number | null>(() => {
    const all = getTotalBudgets();
    return all[currentMonthParam(useSettingsStore.getState().timezone)] ?? null;
  });
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState("");

  // Keep budget preference
  const [keepBudget, setKeepBudgetState] = useState<boolean>(getKeepBudgetPref);

  // Add budget dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Copy month dialog
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<string>(() => stepMonth(currentMonthParam(useSettingsStore.getState().timezone), 1));
  const [copyError, setCopyError] = useState<string | null>(null);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const { data: budgets = [], isLoading, isError } = useBudgets(month);
  const { data: summary } = useBudgetSummary(month);
  const { data: categories = [] } = useCategories("expense");

  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();
  const copyMonth = useCopyMonth();

  const budgetList: Budget[] = Array.isArray(budgets) ? budgets : [];
  const summaryData: BudgetSummary = summary ?? { total_budgeted: 0, total_spent: 0, over_budget_count: 0 };

  // Sync totalBudget from localStorage when month changes
  useEffect(() => {
    const all = getTotalBudgets();
    setTotalBudgetState(all[month] ?? null);
  }, [month]);

  // Auto-copy budgets from previous month when keepBudget is on and current month is empty
  const autoCopiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!keepBudget || isLoading || copyMonth.isPending) return;
    if (budgetList.length === 0 && !autoCopiedRef.current.has(month)) {
      autoCopiedRef.current.add(month);
      const prevMonth = stepMonth(month, -1);
      copyMonth.mutate({ from_month: prevMonth, to_month: month });
      // Also carry over total budget from previous month
      const all = getTotalBudgets();
      if (all[prevMonth] !== undefined && all[month] === undefined) {
        all[month] = all[prevMonth];
        try { localStorage.setItem("denarius-total-budgets", JSON.stringify(all)); } catch {}
        setTotalBudgetState(all[month]);
      }
    }
  }, [month, isLoading, budgetList.length, keepBudget]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeepBudgetChange(v: boolean) {
    setKeepBudgetState(v);
    saveKeepBudgetPref(v);
  }

  function openEditTotal() {
    setTotalInput(totalBudget !== null ? String(totalBudget) : "");
    setEditingTotal(true);
  }

  function handleSaveTotal() {
    const val = parseFloat(totalInput);
    if (isNaN(val) || val <= 0) {
      setEditingTotal(false);
      return;
    }
    saveTotalBudget(month, val);
    setTotalBudgetState(val);
    setEditingTotal(false);
  }

  function handleClearTotal() {
    saveTotalBudget(month, null);
    setTotalBudgetState(null);
    setEditingTotal(false);
  }

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!newCategoryId) { setAddError("Please select a category."); return; }
    if (!newAmount || isNaN(parseFloat(newAmount)) || parseFloat(newAmount) <= 0) {
      setAddError("Please enter a valid positive amount."); return;
    }
    try {
      await createBudget.mutateAsync({
        category_id: newCategoryId,
        amount: parseFloat(newAmount),
        month,
      });
      setAddOpen(false);
      setNewCategoryId("");
      setNewAmount("");
    } catch {
      setAddError("Failed to create budget.");
    }
  }

  async function handleCopyMonth(e: React.FormEvent) {
    e.preventDefault();
    setCopyError(null);
    try {
      await copyMonth.mutateAsync({ from_month: month, to_month: copyTarget });
      setCopyOpen(false);
    } catch {
      setCopyError("Failed to copy budgets.");
    }
  }

  async function handleDelete(id: string) {
    await deleteBudget.mutateAsync(id);
  }

  // Computed totals
  const unallocated = totalBudget !== null ? totalBudget - summaryData.total_budgeted : null;
  const totalRemaining = totalBudget !== null ? totalBudget - summaryData.total_spent : null;
  const totalPct = totalBudget && totalBudget > 0
    ? Math.min(100, (summaryData.total_spent / totalBudget) * 100)
    : null;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm">Track spending against your monthly budget.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Keep Budget Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={keepBudget}
              onCheckedChange={handleKeepBudgetChange}
            />
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Keep for next months
            </span>
          </label>

          {/* Copy Month */}
          <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5" />
                Copy Month
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Copy Budgets to Another Month</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCopyMonth}>
                <div className="space-y-4 py-2">
                  {copyError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                      {copyError}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Copying budgets from <strong>{formatMonth(month)}</strong> to:
                  </p>
                  <div className="space-y-1">
                    <Label>Target Month</Label>
                    <Input
                      type="month"
                      value={copyTarget.slice(0, 7)}
                      onChange={(e) => setCopyTarget(e.target.value + "-01")}
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={copyMonth.isPending}>
                    {copyMonth.isPending ? "Copying…" : "Copy"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add Budget */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Budget</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddBudget}>
                <div className="space-y-4 py-2">
                  {addError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                      {addError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                      <SelectContent>
                        {[...(categories as Category[])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Budget Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For month: <strong>{formatMonth(month)}</strong>
                  </p>
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={createBudget.isPending}>
                    {createBudget.isPending ? "Saving…" : "Save Budget"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => stepMonth(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold w-32 text-center">{formatMonth(month)}</span>
        <Button variant="outline" size="icon" onClick={() => setMonth((m) => stepMonth(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonth(currentMonthParam(timezone))}
          className="text-xs text-muted-foreground"
        >
          Today
        </Button>
      </div>

      {/* Total Budget Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Total Budget</CardTitle>
            {totalBudget !== null && !editingTotal && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditTotal}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingTotal ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Total budget amount…"
                className="w-44 h-8 text-sm"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTotal();
                  if (e.key === "Escape") setEditingTotal(false);
                }}
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveTotal}>Save</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingTotal(false)}>
                Cancel
              </Button>
              {totalBudget !== null && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={handleClearTotal}>
                  Clear
                </Button>
              )}
            </div>
          ) : totalBudget === null ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">No total budget set for {formatMonth(month)}.</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openEditTotal}>
                <Plus className="h-3 w-3 mr-1" />
                Set Total Budget
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <span className={cn(
                    "text-2xl font-bold",
                    summaryData.total_spent > totalBudget ? "text-destructive" : "text-foreground"
                  )}>
                    {formatCurrency(summaryData.total_spent)}
                  </span>
                  <span className="text-muted-foreground text-sm"> / {formatCurrency(totalBudget)}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {totalPct !== null ? `${totalPct.toFixed(0)}% used` : ""}
                </span>
              </div>
              <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    summaryData.total_spent > totalBudget ? "bg-destructive" : "bg-primary"
                  )}
                  style={{ width: `${totalPct ?? 0}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>
                  Allocated: <span className="font-medium text-foreground">{formatCurrency(summaryData.total_budgeted)}</span>
                </span>
                {unallocated !== null && (
                  <span>
                    Unallocated:{" "}
                    <span className={cn("font-medium", unallocated < 0 ? "text-destructive" : "text-foreground")}>
                      {unallocated < 0 ? `-${formatCurrency(Math.abs(unallocated))}` : formatCurrency(unallocated)}
                    </span>
                  </span>
                )}
                {totalRemaining !== null && (
                  <span>
                    Remaining:{" "}
                    <span className={cn("font-medium", totalRemaining < 0 ? "text-destructive" : "text-emerald-500")}>
                      {totalRemaining < 0 ? `-${formatCurrency(Math.abs(totalRemaining))}` : formatCurrency(totalRemaining)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards (category-level) */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Category Budgeted</p>
              <p className="text-xl font-bold">{formatCurrency(summaryData.total_budgeted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
              <p className={cn("text-xl font-bold", summaryData.total_spent > summaryData.total_budgeted ? "text-destructive" : "text-foreground")}>
                {formatCurrency(summaryData.total_spent)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">
                {totalBudget !== null ? "vs Categories" : "Remaining"}
              </p>
              <p className={cn("text-xl font-bold", summaryData.total_budgeted - summaryData.total_spent < 0 ? "text-destructive" : "text-emerald-500")}>
                {formatCurrency(summaryData.total_budgeted - summaryData.total_spent)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Progress */}
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
          Failed to load budgets.
        </div>
      ) : budgetList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm mb-3">No budgets set for {formatMonth(month)}.</p>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add your first budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Budgets</CardTitle>
            <CardDescription className="text-xs">{formatMonth(month)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {budgetList.map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                isEditing={editingId === budget.id}
                editAmount={editAmount}
                onEditStart={() => { setEditingId(budget.id); setEditAmount(String(budget.amount)); }}
                onEditAmountChange={setEditAmount}
                onEditCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(budget.id)}
                deleting={deleteBudget.isPending}
                onEditSaved={() => setEditingId(null)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BudgetRow({
  budget,
  isEditing,
  editAmount,
  onEditStart,
  onEditAmountChange,
  onEditCancel,
  onDelete,
  deleting,
  onEditSaved,
}: {
  budget: Budget;
  isEditing: boolean;
  editAmount: string;
  onEditStart: () => void;
  onEditAmountChange: (v: string) => void;
  onEditCancel: () => void;
  onDelete: () => void;
  deleting: boolean;
  onEditSaved: () => void;
}) {
  const updateBudget = useUpdateBudget(budget.id);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pct = budget.amount > 0 ? Math.min(100, (budget.actual_spent / budget.amount) * 100) : 0;
  const over = budget.actual_spent > budget.amount;
  const remaining = budget.amount - budget.actual_spent;

  async function handleSave() {
    setSaveError(null);
    const val = parseFloat(editAmount);
    if (isNaN(val) || val <= 0) { setSaveError("Enter a valid amount."); return; }
    try {
      await updateBudget.mutateAsync({ amount: val });
      onEditSaved();
    } catch {
      setSaveError("Failed to save.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: budget.category?.color ?? "#6B7280" }}
          />
          <span className="font-medium text-sm truncate">{budget.category?.name ?? "Unknown"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="w-24 h-7 text-sm"
                value={editAmount}
                onChange={(e) => onEditAmountChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onEditCancel(); }}
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={updateBudget.isPending}>
                {updateBudget.isPending ? "…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onEditCancel}>Cancel</Button>
              {saveError && <span className="text-xs text-destructive">{saveError}</span>}
            </>
          ) : (
            <>
              <span className={cn("text-sm font-semibold", over ? "text-destructive" : remaining >= 0 ? "text-emerald-500" : "text-destructive")}>
                {formatCurrency(budget.actual_spent)} / {formatCurrency(budget.amount)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditStart}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% used</span>
        <span className={cn(over ? "text-destructive font-medium" : "")}>
          {over ? `${formatCurrency(Math.abs(remaining))} over budget` : `${formatCurrency(remaining)} remaining`}
        </span>
      </div>
    </div>
  );
}
