import { useState } from "react";
import { Plus, Pencil, Trash2, Moon, Sun } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useThemeStore } from "@/store/themeStore";
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
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from "@/api/accounts";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/api/categories";
import { useAuthStore } from "@/store/authStore";
import api from "@/api/client";
import { cn } from "@/lib/utils";

// ---- Types ----
interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  is_active: boolean;
  institution?: string;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  is_system: boolean;
  color?: string;
  once_per_month: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "member";
  is_active: boolean;
}

// ---- Shared Spinner ----
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ---- Accounts Tab ----
interface AccountFormState {
  name: string;
  type: string;
  balance: string;
  institution: string;
  account_number: string;
  notes: string;
  // Mortgage/Loan fields
  original_principal: string;
  interest_rate: string;
  term_months: string;
  origination_date: string;
  extra_payment: string;
  loan_type: string;
}

const emptyAccountForm = (): AccountFormState => ({
  name: "",
  type: "checking",
  balance: "0",
  institution: "",
  account_number: "",
  notes: "",
  original_principal: "",
  interest_rate: "",
  term_months: "",
  origination_date: "",
  extra_payment: "",
  loan_type: "",
});

const LOAN_TYPES = [
  { value: "auto", label: "Auto" },
  { value: "student", label: "Student" },
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "home_equity", label: "Home Equity" },
  { value: "other", label: "Other" },
];

const MORTGAGE_TYPES = ["mortgage", "loan"];
const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "investment",
  "mortgage",
  "loan",
  "property",
  "cash",
  "other",
];

function AccountsTab() {
  const { data: accounts = [], isLoading, isError } = useAccounts();
  const createAccount = useCreateAccount();

  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm());
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const accountList: Account[] = Array.isArray(accounts) ? accounts : [];
  const isMortgage = MORTGAGE_TYPES.includes(form.type);

  function openAdd() {
    setEditAccount(null);
    setForm(emptyAccountForm());
    setFormError(null);
    setAddOpen(true);
  }

  async function openEdit(account: Account) {
    setEditAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      balance: String(account.current_balance),
      institution: account.institution ?? "",
      account_number: "",
      notes: account.notes ?? "",
      original_principal: "",
      interest_rate: "",
      term_months: "",
      origination_date: "",
      extra_payment: "",
      loan_type: "",
    });
    setFormError(null);
    setAddOpen(true);
    if (MORTGAGE_TYPES.includes(account.type)) {
      try {
        const { data } = await api.get(`/accounts/${account.id}/mortgage`);
        setForm((prev) => ({
          ...prev,
          original_principal: String(data.original_principal),
          interest_rate: String(data.interest_rate),
          term_months: String(data.term_months),
          origination_date: data.start_date,
          extra_payment: String(data.extra_payment),
          loan_type: data.loan_type ?? "",
        }));
      } catch {
        // no mortgage details yet — leave fields empty
      }
    }
  }

  const updateAccount = useUpdateAccount(editAccount?.id ?? "");
  const deleteAccount = useDeleteAccount(deleteId ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError("Account name is required."); return; }
    if (isNaN(parseFloat(form.balance))) { setFormError("Enter a valid balance."); return; }

    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      current_balance: parseFloat(form.balance),
      institution: form.institution || undefined,
      notes: form.notes || undefined,
    };

    try {
      let savedId: string;
      if (editAccount) {
        const result = await updateAccount.mutateAsync(payload);
        savedId = result.id;
      } else {
        const result = await createAccount.mutateAsync(payload);
        savedId = result.id;
      }

      // Handle mortgage/loan details via separate endpoint
      if (isMortgage) {
        const mp: Record<string, unknown> = {};
        if (form.original_principal) mp.original_principal = parseFloat(form.original_principal);
        if (form.interest_rate) mp.interest_rate = parseFloat(form.interest_rate);
        if (form.term_months) mp.term_months = parseInt(form.term_months);
        if (form.origination_date) mp.start_date = form.origination_date;
        if (form.extra_payment) mp.extra_payment = parseFloat(form.extra_payment);
        if (form.type === "loan" && form.loan_type) mp.loan_type = form.loan_type;
        if (Object.keys(mp).length > 0) {
          try {
            if (editAccount) {
              try {
                await api.put(`/accounts/${savedId}/mortgage`, mp);
              } catch (err: any) {
                if (err?.response?.status === 404 && mp.original_principal && mp.interest_rate && mp.term_months && mp.start_date) {
                  await api.post(`/accounts/${savedId}/mortgage`, mp);
                }
              }
            } else if (mp.original_principal && mp.interest_rate && mp.term_months && mp.start_date) {
              await api.post(`/accounts/${savedId}/mortgage`, mp);
            }
          } catch {
            // mortgage save failure is non-fatal
          }
        }
      }

      setAddOpen(false);
    } catch {
      setFormError("Failed to save account. Please try again.");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteAccount.mutateAsync();
      setDeleteOpen(false);
      setDeleteId(null);
    } catch {
      setDeleteOpen(false);
    }
  }

  if (isLoading) return <Spinner />;
  if (isError) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
        Failed to load accounts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{accountList.length} accounts</p>
        <Button size="sm" onClick={openAdd} className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accountList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No accounts yet. Add your first account to get started.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Institution</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {accountList.map((account) => (
                  <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {account.name}
                      {!account.is_active && (
                        <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{account.type.replace("_", " ")}</td>
                    <td className={cn("px-4 py-3 text-right font-semibold", account.current_balance < 0 ? "text-destructive" : "text-foreground")}>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(account.current_balance)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{account.institution ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => { setDeleteId(account.id); setDeleteOpen(true); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAccount ? "Edit Account" : "Add Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>Account Name</Label>
                  <Input
                    placeholder="e.g. Chase Checking"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Current Balance ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Institution</Label>
                  <Input
                    placeholder="e.g. Chase Bank"
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Account Number (last 4)</Label>
                  <Input
                    placeholder="••••1234"
                    maxLength={20}
                    value={form.account_number}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Mortgage/Loan Detail Fields */}
              {isMortgage && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {form.type === "loan" ? "Loan Details" : "Mortgage Details"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {form.type === "loan" && (
                      <div className="space-y-1 col-span-2">
                        <Label>Loan Type</Label>
                        <Select
                          value={form.loan_type}
                          onValueChange={(v) => setForm({ ...form, loan_type: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select loan type…" /></SelectTrigger>
                          <SelectContent>
                            {LOAN_TYPES.map((lt) => (
                              <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Original Principal ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 350000"
                        value={form.original_principal}
                        onChange={(e) => setForm({ ...form, original_principal: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="e.g. 6.5"
                        value={form.interest_rate}
                        onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Term (months)</Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="e.g. 360"
                        value={form.term_months}
                        onChange={(e) => setForm({ ...form, term_months: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Extra Monthly Payment ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 200"
                        value={form.extra_payment}
                        onChange={(e) => setForm({ ...form, extra_payment: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label>Origination Date</Label>
                      <Input
                        type="date"
                        value={form.origination_date}
                        onChange={(e) => setForm({ ...form, origination_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                {createAccount.isPending || updateAccount.isPending ? "Saving…" : "Save Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the account and may affect related transactions.
          </p>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Categories Tab ----
interface CategoryFormState {
  name: string;
  type: string;
  color: string;
  once_per_month: boolean;
}

const emptyCategoryForm = (): CategoryFormState => ({
  name: "",
  type: "expense",
  color: "#6366f1",
  once_per_month: false,
});

function CategoriesTab() {
  const { data: categories = [], isLoading, isError } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [addOpen, setAddOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyCategoryForm());
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const categoryList: Category[] = Array.isArray(categories) ? categories : [];

  function openAdd() {
    setEditCategory(null);
    setForm(emptyCategoryForm());
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(cat: Category) {
    setEditCategory(cat);
    setForm({ name: cat.name, type: cat.type, color: cat.color ?? "#6366f1", once_per_month: cat.once_per_month });
    setFormError(null);
    setAddOpen(true);
  }

  const updateCategory = useUpdateCategory(editCategory?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) { setFormError("Category name is required."); return; }
    try {
      if (editCategory && updateCategory) {
        await updateCategory.mutateAsync({ name: form.name, type: form.type, color: form.color, once_per_month: form.once_per_month });
      } else {
        await createCategory.mutateAsync({ name: form.name, type: form.type, color: form.color, once_per_month: form.once_per_month });
      }
      setAddOpen(false);
    } catch {
      setFormError("Failed to save category.");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteCategory.mutateAsync(deleteId);
    } catch {
      // ignore
    } finally {
      setDeleteOpen(false);
      setDeleteId(null);
    }
  }

  if (isLoading) return <Spinner />;
  if (isError) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
        Failed to load categories.
      </div>
    );
  }

  const sortedList = [...categoryList].sort((a, b) => a.name.localeCompare(b.name));
  const expenseCategories = sortedList.filter((c) => c.type === "expense");
  const incomeCategories = sortedList.filter((c) => c.type === "income");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categoryList.length} categories</p>
        <Button size="sm" onClick={openAdd} className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categoryList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No categories. System categories will appear here.
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { label: "Expense Categories", items: expenseCategories },
            { label: "Income Categories", items: incomeCategories },
          ].map(({ label, items }) =>
            items.length > 0 ? (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {items.map((cat) => (
                        <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {cat.color && (
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                              )}
                              <span className="font-medium">{cat.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">
                            <div className="flex items-center gap-2">
                              <span>{cat.type}</span>
                              {cat.once_per_month && (
                                <Badge variant="outline" className="text-xs py-0 border-amber-400 text-amber-600">
                                  1×/mo
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => { setDeleteId(cat.id); setDeleteOpen(true); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : null
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCategory ? "Edit Category" : "Add Category"}</DialogTitle>
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
                  placeholder="e.g. Groceries"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-14 rounded border border-input cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground">{form.color}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Once per month</p>
                  <p className="text-xs text-muted-foreground">Can only be attached to one recurring bill</p>
                </div>
                <Switch
                  checked={form.once_per_month}
                  onCheckedChange={(v) => setForm({ ...form, once_per_month: v })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createCategory.isPending || (updateCategory?.isPending ?? false)}>
                {createCategory.isPending || updateCategory?.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transactions with this category will become uncategorized.
          </p>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Users Tab ----
function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });
}

function useUpdateUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/users/${userId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

function UsersTab() {
  const { data: users = [], isLoading, isError } = useUsers();
  const userList: User[] = Array.isArray(users) ? users : [];
  const currentUser = useAuthStore((s) => s.user);

  if (isLoading) return <Spinner />;
  if (isError) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
        Failed to load users.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{userList.length} users</p>
      {userList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No users found.</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {userList.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isCurrentUser={user.id === currentUser?.id}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserRow({ user, isCurrentUser }: { user: User; isCurrentUser: boolean }) {
  const updateUser = useUpdateUser(user.id);
  const [roleError, setRoleError] = useState<string | null>(null);

  async function handleRoleChange(newRole: string) {
    setRoleError(null);
    try {
      await updateUser.mutateAsync({ role: newRole });
    } catch {
      setRoleError("Failed to update role.");
    }
  }

  async function handleToggleActive() {
    try {
      await updateUser.mutateAsync({ is_active: !user.is_active });
    } catch {
      // silently fail
    }
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">
        {user.username}
        {isCurrentUser && (
          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3">
        {isCurrentUser ? (
          <Badge variant="outline" className="capitalize">{user.role}</Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={user.role}
              onValueChange={handleRoleChange}
              disabled={updateUser.isPending}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            {roleError && <span className="text-xs text-destructive">{roleError}</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            user.is_active ? "border-emerald-500 text-emerald-600" : "border-muted-foreground text-muted-foreground"
          )}
        >
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {!isCurrentUser && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={handleToggleActive}
            disabled={updateUser.isPending}
          >
            {user.is_active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </td>
    </tr>
  );
}

// ---- Preferences Tab ----
function PreferencesTab() {
  const { isDark, toggle } = useThemeStore();
  const { hiddenAccountIds, toggleAccount } = useDashboardStore();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const accountList: Account[] = Array.isArray(accounts) ? accounts : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">
                  {isDark ? "Dark theme is active" : "Light theme is active"}
                </p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Dashboard Balance Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Choose which accounts appear in the balance history chart on the dashboard.
          </p>
          {accountsLoading ? (
            <div className="py-4 flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : accountList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              {accountList.map((account) => {
                const isVisible = !hiddenAccountIds.includes(account.id);
                return (
                  <div key={account.id} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                    </div>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Settings Page ----
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage accounts, categories, and users.</p>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
        )}

        <TabsContent value="preferences" className="mt-6">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
