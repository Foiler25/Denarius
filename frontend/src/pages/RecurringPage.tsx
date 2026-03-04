import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, CheckCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useRecurring,
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  useMarkPaid,
} from "@/api/recurring";
import { useAccounts } from "@/api/accounts";
import { useCategories } from "@/api/categories";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  amount_min?: number | null;
  amount_max?: number | null;
  type: "subscription" | "bill" | "income";
  frequency: string;
  next_due_date: string;
  days_until_due: number;
  is_active: boolean;
  account_id?: string;
  category_id?: string;
  notes?: string;
  auto_match?: boolean;
  keyword_match?: string | null;
  last_paid_date?: string | null;
  last_paid_amount?: number | null;
  last_paid_transaction_id?: string | null;
  is_paid_current_period?: boolean;
}

interface Account { id: string; name: string; type: string; }
interface Category { id: string; name: string; type: string; }

interface RecurringFormState {
  name: string;
  amount: string;
  amount_min: string;
  amount_max: string;
  is_variable: boolean;
  type: string;
  frequency: string;
  start_date: string;
  account_id: string;
  category_id: string;
  notes: string;
  auto_match: boolean;
  keyword_match: string;
}

const emptyForm = (): RecurringFormState => ({
  name: "",
  amount: "",
  amount_min: "",
  amount_max: "",
  is_variable: false,
  type: "bill",
  frequency: "monthly",
  start_date: new Date().toISOString().slice(0, 10),
  account_id: "none",
  category_id: "none",
  notes: "",
  auto_match: false,
  keyword_match: "",
});

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function dueBadgeClass(days: number) {
  if (days < 0) return "border-destructive bg-destructive/10 text-destructive";
  if (days <= 7) return "border-yellow-500 bg-yellow-50 text-yellow-700";
  return "border-emerald-500 bg-emerald-50 text-emerald-700";
}

function dueLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

function RecurringTab({
  type,
  label,
}: {
  type: "subscription" | "bill" | "income";
  label: string;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringItem | null>(null);
  const [form, setForm] = useState<RecurringFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState("");

  const { data: items = [], isLoading, isError } = useRecurring(type, !showInactive);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const createRecurring = useCreateRecurring();
  const deleteRecurring = useDeleteRecurring();
  const markPaid = useMarkPaid();

  const recurringList: RecurringItem[] = Array.isArray(items) ? items : [];

  function openAdd() {
    setEditItem(null);
    setForm({ ...emptyForm(), type });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: RecurringItem) {
    setEditItem(item);
    const isVariable = item.amount_min != null && item.amount_max != null;
    setForm({
      name: item.name,
      amount: String(item.amount),
      amount_min: item.amount_min != null ? String(item.amount_min) : "",
      amount_max: item.amount_max != null ? String(item.amount_max) : "",
      is_variable: isVariable,
      type: item.type,
      frequency: item.frequency,
      start_date: item.next_due_date,
      account_id: item.account_id || "none",
      category_id: item.category_id || "none",
      notes: item.notes ?? "",
      auto_match: item.auto_match ?? false,
      keyword_match: item.keyword_match ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  const updateRecurring = useUpdateRecurring(editItem?.id ?? ""); // always called to satisfy rules of hooks

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (form.is_variable) {
      const min = parseFloat(form.amount_min);
      const max = parseFloat(form.amount_max);
      if (!form.amount_min || isNaN(min) || min <= 0) { setFormError("Valid minimum amount is required."); return; }
      if (!form.amount_max || isNaN(max) || max <= 0) { setFormError("Valid maximum amount is required."); return; }
      if (max <= min) { setFormError("Maximum must be greater than minimum."); return; }
    } else {
      if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
        setFormError("Valid amount is required."); return;
      }
    }
    if (form.account_id === "none") { setFormError("Please select an account."); return; }
    try {
      const min = form.is_variable ? parseFloat(form.amount_min) : null;
      const max = form.is_variable ? parseFloat(form.amount_max) : null;
      const payload = {
        ...form,
        amount: form.is_variable ? (min! + max!) / 2 : parseFloat(form.amount),
        amount_min: min,
        amount_max: max,
        next_due_date: form.start_date,
        account_id: form.account_id,
        category_id: form.category_id === "none" ? null : form.category_id,
        auto_match: form.auto_match,
        keyword_match: form.keyword_match.trim() || null,
      };
      if (editItem) {
        await updateRecurring.mutateAsync(payload);
      } else {
        await createRecurring.mutateAsync(payload);
      }
      setFormOpen(false);
    } catch {
      setFormError("Failed to save. Please try again.");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteRecurring.mutateAsync(deleteId);
    setDeleteOpen(false);
    setDeleteId(null);
  }

  async function handleMarkPaid() {
    if (!markPaidId) return;
    await markPaid.mutateAsync({
      id: markPaidId,
      date: paidDate,
      amount: paidAmount ? parseFloat(paidAmount) : undefined,
    });
    setMarkPaidOpen(false);
    setMarkPaidId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{recurringList.length} {label.toLowerCase()}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Show Active Only" : "Show Inactive"}
          </Button>
        </div>
        <Button size="sm" onClick={openAdd} className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Add {label.endsWith("s") ? label.slice(0, -1) : label}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
          Failed to load {label.toLowerCase()}.
        </div>
      ) : recurringList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No {label.toLowerCase()} found. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recurringList.map((item) => (
            <RecurringCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => { setDeleteId(item.id); setDeleteOpen(true); }}
              onMarkPaid={() => {
                setMarkPaidId(item.id);
                setPaidDate(new Date().toISOString().slice(0, 10));
                setPaidAmount(String(item.amount));
                setMarkPaidOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit" : "Add"} {label.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {formError}
                </div>
              )}
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Netflix"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Amount ($)</Label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_variable: !form.is_variable, amount: "", amount_min: "", amount_max: "" })}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border transition-colors",
                      form.is_variable
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    Variable range
                  </button>
                </div>
                {form.is_variable ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Min"
                      value={form.amount_min}
                      onChange={(e) => setForm({ ...form, amount_min: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Max"
                      value={form.amount_max}
                      onChange={(e) => setForm({ ...form, amount_max: e.target.value })}
                    />
                  </div>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Next Due / Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Account</Label>
                  <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(accounts as Account[]).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {[...(categories as Category[])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Auto-match transactions</Label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, auto_match: !form.auto_match })}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border transition-colors",
                      form.auto_match
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {form.auto_match ? "Enabled" : "Disabled"}
                  </button>
                </div>
                {form.auto_match && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Keywords (comma-separated, matched against transaction description)
                    </Label>
                    <Input
                      placeholder="e.g. Netflix, NETFLIX"
                      value={form.keyword_match}
                      onChange={(e) => setForm({ ...form, keyword_match: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      New transactions whose description contains a keyword and amount falls within the configured range will be auto-linked and marked paid.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createRecurring.isPending || updateRecurring.isPending}>
                {createRecurring.isPending || updateRecurring.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRecurring.isPending}>
              {deleteRecurring.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Payment Date</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount Paid ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleMarkPaid} disabled={markPaid.isPending}>
              {markPaid.isPending ? "Saving…" : "Mark Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecurringCard({
  item,
  onEdit,
  onDelete,
  onMarkPaid,
}: {
  item: RecurringItem;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
}) {
  const updateRecurring = useUpdateRecurring(item.id);
  const navigate = useNavigate();
  const isPaid = item.is_paid_current_period === true;

  async function handleToggle() {
    await updateRecurring.mutateAsync({ is_active: !item.is_active });
  }

  return (
    <Card className={cn("relative", !item.is_active && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{item.name}</CardTitle>
          {isPaid ? (
            <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 text-xs shrink-0">
              Paid
            </Badge>
          ) : (
            <Badge variant="outline" className={cn("text-xs shrink-0", dueBadgeClass(item.days_until_due))}>
              {dueLabel(item.days_until_due)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          {item.amount_min != null && item.amount_max != null ? (
            <div>
              <span className="text-2xl font-bold">
                {formatCurrency(item.amount_min)}–{formatCurrency(item.amount_max)}
              </span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                ~{formatCurrency(item.amount)} avg
              </span>
            </div>
          ) : (
            <span className="text-2xl font-bold">{formatCurrency(item.amount)}</span>
          )}
          <span className="text-xs text-muted-foreground capitalize">{item.frequency}</span>
        </div>
        {isPaid ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium">
              {formatCurrency(item.last_paid_amount ?? item.amount)} paid
              {item.last_paid_date ? ` · ${formatDate(item.last_paid_date)}` : ""}
            </span>
            {item.last_paid_transaction_id && (
              <button
                className="text-primary hover:underline underline-offset-2"
                onClick={() => navigate("/transactions")}
              >
                View →
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Next due: {formatDate(item.next_due_date)}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8 flex items-center gap-1"
            onClick={onMarkPaid}
            disabled={!item.is_active || isPaid}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Mark Paid
          </Button>
          {item.category_id && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => navigate(`/transactions?category_id=${item.category_id}`)}
            >
              {item.type === "subscription" ? "View Subs" : "View Bills"}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
            disabled={updateRecurring.isPending}
            title={item.is_active ? "Deactivate" : "Activate"}
          >
            {item.is_active ? (
              <ToggleRight className="h-4 w-4 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecurringPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recurring</h1>
        <p className="text-muted-foreground text-sm">Manage subscriptions, bills, and recurring income.</p>
      </div>

      <Tabs defaultValue="bill">
        <TabsList>
          <TabsTrigger value="subscription">Subscriptions</TabsTrigger>
          <TabsTrigger value="bill">Bills</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value="subscription" className="mt-4">
          <RecurringTab type="subscription" label="Subscriptions" />
        </TabsContent>
        <TabsContent value="bill" className="mt-4">
          <RecurringTab type="bill" label="Bills" />
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          <RecurringTab type="income" label="Income" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
