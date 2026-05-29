import { appDefaults } from "@/lib/config";

export function money(value: number | string | null | undefined, currency = appDefaults.currency) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthEndISO(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
