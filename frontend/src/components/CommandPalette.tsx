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
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { cn } from "@/lib/utils";

type ResultType = "transaction" | "account" | "expense_account" | "category" | "recurring";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  /** Per-type extras needed by the navigation handler (recurring tab, txn description, …). */
  meta?: { recurringType?: string };
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

const TYPE_ORDER: ResultType[] = ["transaction", "account", "expense_account", "category", "recurring"];

const TYPE_META: Record<
  ResultType,
  {
    icon: LucideIcon;
    label: string;
    sectionLabel: string;
    route: (r: SearchResult) => string;
  }
> = {
  transaction: {
    icon: ArrowLeftRight,
    label: "Transaction",
    sectionLabel: "Transactions",
    route: (r) => `/transactions?highlight=${r.id}&q=${encodeURIComponent(r.title)}`,
  },
  account: {
    icon: Wallet,
    label: "Account",
    sectionLabel: "Accounts",
    route: (r) => `/accounts?open=${r.id}`,
  },
  expense_account: {
    icon: ShoppingCart,
    label: "Expense Acct",
    sectionLabel: "Expense Accounts",
    route: (r) => `/expense-accounts?open=${r.id}`,
  },
  category: {
    icon: Tag,
    label: "Category",
    sectionLabel: "Categories",
    route: (r) => `/categories?open=${r.id}`,
  },
  recurring: {
    icon: RotateCcw,
    label: "Recurring",
    sectionLabel: "Recurring",
    route: (r) => `/recurring${r.meta?.recurringType ? `?tab=${r.meta.recurringType}` : ""}`,
  },
};

interface StaticPaletteData {
  accounts: Array<{ id: string; name: string; type?: string }>;
  expense_accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type?: string }>;
  recurring: Array<{ id: string; name: string; type?: string; amount?: number }>;
}

async function fetchStaticData(): Promise<StaticPaletteData> {
  const [ac, ex, ca, rc] = await Promise.all([
    api.get("/accounts").then((r) => r.data).catch(() => []),
    api.get("/expense-accounts").then((r) => r.data).catch(() => []),
    api.get("/categories").then((r) => r.data).catch(() => []),
    api.get("/recurring", { params: { is_active: true } }).then((r) => r.data).catch(() => []),
  ]);
  return {
    accounts: Array.isArray(ac) ? ac : [],
    expense_accounts: Array.isArray(ex) ? ex : [],
    categories: Array.isArray(ca) ? ca : [],
    recurring: Array.isArray(rc) ? rc : [],
  };
}

interface TxRow {
  id: string;
  description?: string;
  date?: string;
  amount?: number;
  account_name?: string;
}

async function fetchTransactionMatches(q: string): Promise<TxRow[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const r = await api
    .get("/transactions", { params: { search: trimmed, limit: 50, page: 1 } })
    .catch(() => ({ data: { items: [] } }));
  const data = r.data;
  return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
}

function rankResults(
  needle: string,
  staticData: StaticPaletteData | undefined,
  txMatches: TxRow[],
): SearchResult[] {
  const trimmed = needle.trim().toLowerCase();
  if (!trimmed) return [];

  const out: SearchResult[] = [];

  for (const t of txMatches) {
    out.push({
      id: t.id,
      type: "transaction",
      title: t.description ?? "(no description)",
      subtitle: [t.date, t.account_name, t.amount != null ? `$${Number(t.amount).toFixed(2)}` : null]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (staticData) {
    for (const a of staticData.accounts) {
      if (a.name.toLowerCase().includes(trimmed)) {
        out.push({ id: a.id, type: "account", title: a.name, subtitle: a.type });
      }
    }
    for (const e of staticData.expense_accounts) {
      if (e.name.toLowerCase().includes(trimmed)) {
        out.push({ id: e.id, type: "expense_account", title: e.name });
      }
    }
    for (const c of staticData.categories) {
      if (c.name.toLowerCase().includes(trimmed)) {
        out.push({ id: c.id, type: "category", title: c.name, subtitle: c.type });
      }
    }
    for (const r of staticData.recurring) {
      if (r.name.toLowerCase().includes(trimmed)) {
        out.push({
          id: r.id,
          type: "recurring",
          title: r.name,
          subtitle: [r.type, r.amount != null ? `$${Number(r.amount).toFixed(2)}` : null]
            .filter(Boolean)
            .join(" · "),
          meta: { recurringType: r.type },
        });
      }
    }
  }

  // Stable ordering by section
  out.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  return out.slice(0, 80);
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
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
  const listContainerRef = useRef<HTMLDivElement>(null);

  const debouncedQ = useDebouncedValue(q, 200);

  const { data: staticData, isFetching: staticFetching } = useQuery({
    queryKey: ["palette-static"],
    queryFn: fetchStaticData,
    enabled: open,
    staleTime: 30_000,
  });

  const { data: txMatches = [], isFetching: txFetching } = useQuery({
    queryKey: ["palette-tx", debouncedQ],
    queryFn: () => fetchTransactionMatches(debouncedQ),
    enabled: open && debouncedQ.trim().length > 0,
    staleTime: 30_000,
  });

  const isFetching = staticFetching || txFetching;

  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
      setSelectedIdx(0);
    }
  }, [open]);

  const list = useMemo(() => rankResults(debouncedQ, staticData, txMatches), [debouncedQ, staticData, txMatches]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [debouncedQ]);

  // Keep the highlighted row visible when arrow-keying through long lists
  useEffect(() => {
    if (!open) return;
    const node = listContainerRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open, list]);

  const choose = (r: SearchResult) => {
    pushRecent(q);
    navigate(TYPE_META[r.type].route(r));
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

          <div ref={listContainerRef} className="max-h-[50vh] overflow-y-auto">
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
              const prev = list[i - 1];
              const showHeader = !prev || prev.type !== r.type;
              return (
                <Fragment key={`${r.type}-${r.id}`}>
                  {showHeader && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {meta.sectionLabel}
                    </div>
                  )}
                  <button
                    data-idx={i}
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
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                </Fragment>
              );
            })}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
