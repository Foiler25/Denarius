import * as RadixDialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  ArrowRight,
  ArrowLeftRight,
  Wallet,
  ShoppingCart,
  Tag,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { cn } from "@/lib/utils";

type ResultType = "transaction" | "account" | "expense_account" | "category" | "recurring";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
}

const RECENT_KEY = "denarius.recent-searches";

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  if (!q.trim()) return;
  const prev = getRecent().filter((x) => x !== q);
  const next = [q, ...prev].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

const TYPE_META: Record<ResultType, { icon: LucideIcon; route: (id: string) => string; label: string }> = {
  transaction: { icon: ArrowLeftRight, route: () => "/transactions", label: "Transaction" },
  account: { icon: Wallet, route: () => "/accounts", label: "Account" },
  expense_account: { icon: ShoppingCart, route: () => "/expense-accounts", label: "Expense Acct" },
  category: { icon: Tag, route: () => "/categories", label: "Category" },
  recurring: { icon: RotateCcw, route: () => "/recurring", label: "Recurring" },
};

interface PaletteData {
  transactions: Array<{ id: string; description?: string; date?: string; amount?: number; account_name?: string }>;
  accounts: Array<{ id: string; name: string; type?: string }>;
  expense_accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type?: string }>;
  recurring: Array<{ id: string; name: string; type?: string; amount?: number }>;
}

async function fetchPaletteData(): Promise<PaletteData> {
  const [tx, ac, ex, ca, rc] = await Promise.all([
    api.get("/transactions", { params: { limit: 200 } }).then((r) => r.data).catch(() => []),
    api.get("/accounts").then((r) => r.data).catch(() => []),
    api.get("/expense-accounts").then((r) => r.data).catch(() => []),
    api.get("/categories").then((r) => r.data).catch(() => []),
    api.get("/recurring", { params: { is_active: true } }).then((r) => r.data).catch(() => []),
  ]);

  const txList = Array.isArray(tx) ? tx : Array.isArray(tx?.items) ? tx.items : [];
  return {
    transactions: txList,
    accounts: Array.isArray(ac) ? ac : [],
    expense_accounts: Array.isArray(ex) ? ex : [],
    categories: Array.isArray(ca) ? ca : [],
    recurring: Array.isArray(rc) ? rc : [],
  };
}

function rankResults(data: PaletteData | undefined, q: string): SearchResult[] {
  if (!data) return [];
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  const out: SearchResult[] = [];

  for (const t of data.transactions) {
    const desc = (t.description ?? "").toLowerCase();
    if (desc.includes(needle)) {
      out.push({
        id: t.id,
        type: "transaction",
        title: t.description ?? "(no description)",
        subtitle: [t.date, t.account_name, t.amount != null ? `$${Number(t.amount).toFixed(2)}` : null].filter(Boolean).join(" · "),
      });
      if (out.length > 40) break;
    }
  }
  for (const a of data.accounts) {
    if (a.name.toLowerCase().includes(needle)) {
      out.push({ id: a.id, type: "account", title: a.name, subtitle: a.type });
    }
  }
  for (const e of data.expense_accounts) {
    if (e.name.toLowerCase().includes(needle)) {
      out.push({ id: e.id, type: "expense_account", title: e.name });
    }
  }
  for (const c of data.categories) {
    if (c.name.toLowerCase().includes(needle)) {
      out.push({ id: c.id, type: "category", title: c.name, subtitle: c.type });
    }
  }
  for (const r of data.recurring) {
    if (r.name.toLowerCase().includes(needle)) {
      out.push({
        id: r.id,
        type: "recurring",
        title: r.name,
        subtitle: [r.type, r.amount != null ? `$${Number(r.amount).toFixed(2)}` : null].filter(Boolean).join(" · "),
      });
    }
  }

  return out.slice(0, 50);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["command-palette"],
    queryFn: fetchPaletteData,
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
      setSelectedIdx(0);
    }
  }, [open]);

  const list = useMemo(() => rankResults(data, q), [data, q]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [q]);

  const choose = (r: SearchResult) => {
    pushRecent(q);
    navigate(TYPE_META[r.type].route(r.id));
    onOpenChange(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && list[selectedIdx]) {
      e.preventDefault();
      choose(list[selectedIdx]);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" />
        <RadixDialog.Content
          className="fixed left-1/2 top-[20%] z-50 -translate-x-1/2 w-[95vw] max-w-xl rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          onKeyDown={onKeyDown}
        >
          <RadixDialog.Title className="sr-only">Search</RadixDialog.Title>
          <div className="flex items-center gap-2 px-4 h-12 border-b">
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search transactions, accounts, categories…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-block text-[10px] rounded border px-1 py-0.5 text-muted-foreground">
              ESC
            </kbd>
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {!q && recent.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </div>
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQ(r)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {q && !isFetching && list.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results</div>
            )}

            {list.map((r, i) => {
              const meta = TYPE_META[r.type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => choose(r)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm",
                    i === selectedIdx && "bg-[var(--ea-accent-soft)] dark:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    {r.subtitle && <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">{meta.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
