import { useState } from "react";
import { Plus, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface Transaction {
  id: string;
  date: string;
  description: string;
  category_id?: string;
  category_name?: string;
  account_id: string;
  account_name?: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  cleared: boolean;
  notes?: string;
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
  category_id: string;
  cleared: boolean;
  notes: string;
}

const emptyForm = (): TxFormState => ({
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  type: "expense",
  account_id: "",
  category_id: "",
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

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<TxFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const queryParams: Record<string, unknown> = {
    page,
    per_page: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(accountFilter !== "all" ? { account_id: accountFilter } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
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

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.description.trim()) { setFormError("Description is required."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setFormError("Valid amount is required."); return; }
    if (!form.account_id) { setFormError("Account is required."); return; }
    try {
      await createTx.mutateAsync({
        ...form,
        amount: parseFloat(form.amount),
      });
      setAddOpen(false);
      setForm(emptyForm());
    } catch {
      setFormError("Failed to add transaction. Please try again.");
    }
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
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
                    <Label>Account</Label>
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
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Uncategorized</SelectItem>
                      {(categories as Category[]).map((c) => (
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
                setSearch(""); setAccountFilter("all"); setTypeFilter("all");
                setStartDate(""); setEndDate(""); setPage(1);
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

function TransactionRow({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const updateTx = useUpdateTransaction(tx.id);
  const [cleared, setCleared] = useState(tx.cleared);

  async function handleClearedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.checked;
    setCleared(newVal);
    try {
      await updateTx.mutateAsync({ cleared: newVal });
    } catch {
      setCleared(!newVal);
    }
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(tx.date)}</td>
      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{tx.description}</td>
      <td className="px-4 py-3 text-muted-foreground">{tx.category_name ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{tx.account_name ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize",
            tx.type === "income" ? "border-emerald-500 text-emerald-600" :
            tx.type === "expense" ? "border-destructive text-destructive" :
            "border-muted-foreground text-muted-foreground"
          )}
        >
          {tx.type}
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
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
