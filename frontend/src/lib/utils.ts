import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function firstOfMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Returns today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayString(tz: string): string {
  // en-CA locale produces YYYY-MM-DD format natively
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** Returns the first day of the current month as YYYY-MM-DD in the given IANA timezone. */
export function currentMonthParam(tz: string): string {
  const today = todayString(tz);
  return today.slice(0, 7) + "-01";
}
