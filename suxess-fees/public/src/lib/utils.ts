import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}


/** Same calendar day next month (e.g. 2026-10-22 → 2026-11-22). */
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month-end overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d.toISOString().slice(0, 10);
}

export function addOneMonth(isoDate: string): string {
  return addMonths(isoDate, 1);
}


export function isTutorialCampusName(name?: string | null): boolean {
  if (!name) return false;
  const s = name.toLowerCase();
  return s.includes("arepo") || s.includes("ofada") || s.includes("mowe");
}


/** Add N calendar days to an ISO date (YYYY-MM-DD). */
export function addDaysToDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
