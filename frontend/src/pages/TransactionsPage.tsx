import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useTransactions, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "@/api/transactions";
import { useAccounts } from "@/api/accounts";
import { useCategories } from "@/api/categories";
import { formatCurrency, formatDate, todayString, cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

const PAGE_SIZE = 20;

interface Transaction {
  id: string;
  date: string;
  description: string;
  category_id?: string;
  category?: { id: string; name: string; type: string } | null;
  account_id: string;
  transfer_account_id?: string | null;
  recurring_item?: { type: string } | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  is_cleared: boolean;
  notes?: string;
}

function getTxLabel(tx: Transaction): string {
  if (tx.recurring_item?.type === "subscription") return "Sub";
  if (tx.recurring_item?.type === "bill") return "Bill";
  if (/mortgage|loan/i.test(tx.category?.name ?? "")) return "Loan";
  return tx.type;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TxFormState {
  date: string;
  description: string;
  amount: string;
  type: string;
  account_id: string;
  transfer_account_id: string;
  category_id: string;
  cleared: boolean;
  notes: string;
}

const emptyForm = (tz: string): TxFormState => ({
  date: todayString(tz),
  description: "",
  amount: "",
  type: "expense",
  account_id: "",
  transfer_account_id: "",
  category_id: "none",
  cleared: false,
  notes: "",
});

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function currentMonthDates(tz: string) {
  const today = todayString(tz);
  const start = today.slice(0, 7) + "-01";
  return { start, end: today };
}

export default function TransactionsPage() {
  const { timezone } = useSettingsStore();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category_id") ?? "all");
  const [startDate, setStartDate] = useState(() => currentMonthDates(useSettingsStore.getState().timezone).start);
  const [endDate, setEndDate] = useState(() => currentMonthDates(useSettingsStore.getState().timezone).end);
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<TxFormState>(() => emptyForm(useSettingsStore.getState().timezone));
  const [formError, setFormError] = useState<string | null>(null);
  const [overridePromptOpen, setOverridePromptOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const queryParams: Record<string, unknown> = {
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(accountFilter !== "all" ? { account_id: accountFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(categoryFilter !== "all" ? { category_id: categoryFilter } : {}),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  };

  const { data: txData, isLoading, isError } = useTransactions(queryParams);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const transactions: Transaction[] = txData?.items ?? txData ?? [];
  const totalPages: number = txData?.pages ?? 1;

  function handleFilterChange() {
    setPage(1);
  }

  function buildAddPayload(override?: string): Record<string, unknown> {
    return {
      date: form.date,
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      account_id: form.account_id,
      is_cleared: form.cleared,
      notes: form.notes || null,
      category_id: form.category_id !== "none" && form.category_id ? form.category_id : null,
      transfer_account_id: form.type === "transfer" && form.transfer_account_id ? form.transfer_account_id : null,
      ...(override ? { once_per_month_override: override } : {}),
    };
  }

  async function submitAddPayload(payload: Record<string, unknown>) {
    try {
      await createTx.mutateAsync(payload);
      setAddOpen(false);
      setForm(emptyForm(timezone));
      setOverridePromptOpen(false);
      setPendingPayload(null);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; headers?: Record<string, string> } }).response;
      if (resp?.status === 409 && resp.headers?.["x-conflict"] === "once_per_month") {
        setPendingPayload(payload);
        setOverridePromptOpen(true);
      } else {
        setFormError("Failed to add transaction. Please try again.");
      }
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.description.trim()) { setFormError("Description is required."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setFormError("Valid amount is required."); return; }
    if (!form.account_id) { setFormError("From account is required."); return; }
    if (form.type === "transfer" && !form.transfer_account_id) { setFormError("To account is required for transfers."); return; }
    if (form.type === "transfer" && form.transfer_account_id === form.account_id) { setFormError("From and To accounts must be different."); return; }
    await submitAddPayload(buildAddPayload());
  }

  async function handleAddOverride(override: string) {
    if (!pendingPayload) return;
    await submitAddPayload({ ...pendingPayload, once_per_month_override: override });
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTx.mutateAsync(deleteId);
      setDeleteOpen(false);
      setDeleteId(null);
    } catch {
      // silently close; the query will still be valid
      setDeleteOpen(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm">Browse and manage your financial activity.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit}>
              <div className="space-y-4 py-2">
                {formError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                    {formError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, transfer_account_id: v !== "transfer" ? "" : form.transfer_account_id })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g. Grocery run"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{form.type === "transfer" ? "From Account" : "Account"}</Label>
                    <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {(accounts as Account[]).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.type === "transfer" && (
                  <div className="space-y-1">
                    <Label>To Account</Label>
                    <Select value={form.transfer_account_id} onValueChange={(v) => setForm({ ...form, transfer_account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {(accounts as Account[]).filter((a) => a.id !== form.account_id).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {[...(categories as Category[])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="cleared-add"
                    type="checkbox"
                    checked={form.cleared}
                    onChange={(e) => setForm({ ...form, cleared: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="cleared-add">Cleared / Reconciled</Label>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={createTx.isPending}>
                  {createTx.isPending ? "Saving…" : "Save Transaction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Description…"
                  className="pl-8"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                />
              </div>
            </div>
            <div className="min-w-[140px] space-y-1">
              <Label className="text-xs">Account</Label>
              <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); handleFilterChange(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {(accounts as Account[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px] space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); handleFilterChange(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px] space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); handleFilterChange(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {[...(categories as Category[])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="w-36"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="w-36"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const { start, end } = currentMonthDates(timezone);
                setSearch(""); setAccountFilter("all"); setTypeFilter("all");
                setCategoryFilter("all"); setStartDate(start); setEndDate(end); setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Spinner />
          ) : isError ? (
            <div className="px-6 py-4 text-sm text-destructive">Failed to load transactions.</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              No transactions found. Try adjusting filters or add your first transaction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Cleared</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      accounts={accounts as Account[]}
                      categories={categories as Category[]}
                      onDelete={() => { setDeleteId(tx.id); setDeleteOpen(true); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Once-Per-Month Override Prompt */}
      <Dialog open={overridePromptOpen} onOpenChange={(o) => { if (!o) { setOverridePromptOpen(false); setPendingPayload(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Category already used this month</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This category is set to once per month but already has a transaction recorded. What type of payment is this?
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={() => handleAddOverride("extra_payment")} disabled={createTx.isPending} variant="outline">
              Extra Payment
              <span className="ml-2 text-xs text-muted-foreground">— additional payment, bill stays the same</span>
            </Button>
            <Button onClick={() => handleAddOverride("next_month_payment")} disabled={createTx.isPending} variant="outline">
              Next Month Payment
              <span className="ml-2 text-xs text-muted-foreground">— paying ahead, advances bill cycle</span>
            </Button>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The transaction will be permanently removed.
          </p>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTx.isPending}>
              {deleteTx.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionRow({ tx, accounts, categories, onDelete }: { tx: Transaction; accounts: Account[]; categories: Category[]; onDelete: () => void }) {
  const updateTx = useUpdateTransaction(tx.id);
  const [cleared, setCleared] = useState(tx.is_cleared);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<TxFormState>({
    date: tx.date,
    description: tx.description ?? "",
    amount: String(tx.amount),
    type: tx.type,
    account_id: tx.account_id,
    transfer_account_id: tx.transfer_account_id ?? "",
    category_id: tx.category_id ?? "none",
    cleared: tx.is_cleared,
    notes: tx.notes ?? "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editOverrideOpen, setEditOverrideOpen] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, unknown> | null>(null);
  const accountName = accounts.find((a) => a.id === tx.account_id)?.name ?? "—";

  async function handleClearedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.checked;
    setCleared(newVal);
    try {
      await updateTx.mutateAsync({ is_cleared: newVal });
    } catch {
      setCleared(!newVal);
    }
  }

  function buildEditPayload(override?: string): Record<string, unknown> {
    return {
      date: editForm.date,
      description: editForm.description,
      amount: editForm.amount,
      type: editForm.type,
      account_id: editForm.account_id,
      is_cleared: editForm.cleared,
      notes: editForm.notes || null,
      category_id: editForm.category_id !== "none" && editForm.category_id ? editForm.category_id : null,
      transfer_account_id: editForm.type === "transfer" && editForm.transfer_account_id ? editForm.transfer_account_id : null,
      ...(override ? { once_per_month_override: override } : {}),
    };
  }

  async function submitEditPayload(payload: Record<string, unknown>) {
    try {
      await updateTx.mutateAsync(payload);
      setEditOpen(false);
      setEditOverrideOpen(false);
      setPendingEditPayload(null);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; headers?: Record<string, string> } }).response;
      if (resp?.status === 409 && resp.headers?.["x-conflict"] === "once_per_month") {
        setPendingEditPayload(payload);
        setEditOverrideOpen(true);
      } else {
        setEditError("Failed to save changes. Please try again.");
      }
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    if (!editForm.description.trim()) { setEditError("Description is required."); return; }
    if (!editForm.amount || isNaN(parseFloat(editForm.amount))) { setEditError("Valid amount is required."); return; }
    if (!editForm.account_id) { setEditError("Account is required."); return; }
    if (editForm.type === "transfer" && !editForm.transfer_account_id) { setEditError("To account is required for transfers."); return; }
    if (editForm.type === "transfer" && editForm.transfer_account_id === editForm.account_id) { setEditError("From and To accounts must be different."); return; }
    await submitEditPayload(buildEditPayload());
  }

  async function handleEditOverride(override: string) {
    if (!pendingEditPayload) return;
    await submitEditPayload({ ...pendingEditPayload, once_per_month_override: override });
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(tx.date)}</td>
      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{tx.description}</td>
      <td className="px-4 py-3 text-muted-foreground">{tx.category?.name ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{accountName}</td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize",
            tx.type === "income" ? "border-emerald-500 text-emerald-600" :
            tx.type === "transfer" ? "border-muted-foreground text-muted-foreground" :
            "border-destructive text-destructive"
          )}
        >
          {getTxLabel(tx)}
        </Badge>
      </td>
      <td className={cn("px-4 py-3 text-right font-semibold", tx.type === "income" ? "text-emerald-600" : "text-destructive")}>
        {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
        {formatCurrency(tx.amount)}
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={cleared}
          onChange={handleClearedChange}
          className="h-4 w-4 rounded border-input cursor-pointer"
          title="Mark as cleared"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit}>
                <div className="space-y-4 py-2">
                  {editError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                      {editError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v, transfer_account_id: v !== "transfer" ? "" : editForm.transfer_account_id })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{editForm.type === "transfer" ? "From Account" : "Account"}</Label>
                      <Select value={editForm.account_id} onValueChange={(v) => setEditForm({ ...editForm, account_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {editForm.type === "transfer" && (
                    <div className="space-y-1">
                      <Label>To Account</Label>
                      <Select value={editForm.transfer_account_id} onValueChange={(v) => setEditForm({ ...editForm, transfer_account_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter((a) => a.id !== editForm.account_id).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={editForm.category_id} onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input
                      placeholder="Optional notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`cleared-edit-${tx.id}`}
                      type="checkbox"
                      checked={editForm.cleared}
                      onChange={(e) => setEditForm({ ...editForm, cleared: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor={`cleared-edit-${tx.id}`}>Cleared / Reconciled</Label>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={updateTx.isPending}>
                    {updateTx.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>

      {/* Edit — Once-Per-Month Override Prompt */}
      <Dialog open={editOverrideOpen} onOpenChange={(o) => { if (!o) { setEditOverrideOpen(false); setPendingEditPayload(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Category already used this month</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This category is set to once per month but already has a transaction recorded. What type of payment is this?
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={() => handleEditOverride("extra_payment")} disabled={updateTx.isPending} variant="outline">
              Extra Payment
              <span className="ml-2 text-xs text-muted-foreground">— additional payment, bill stays the same</span>
            </Button>
            <Button onClick={() => handleEditOverride("next_month_payment")} disabled={updateTx.isPending} variant="outline">
              Next Month Payment
              <span className="ml-2 text-xs text-muted-foreground">— paying ahead, advances bill cycle</span>
            </Button>
          </div>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </tr>
  );
}
