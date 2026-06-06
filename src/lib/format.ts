import { appDefaults } from "./config.ts";

export function money(value: number | string | null | undefined, currency = appDefaults.currency) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function todayISO() {
  return businessDateISO();
}

export function monthEndISO(date = new Date()) {
  const parts = businessDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(new Date(parts.year, parts.month, 0).getDate()).padStart(2, "0")}`;
}

export function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function businessDateParts(date = new Date(), timeZone = "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function businessDateISO(date = new Date(), timeZone = "Asia/Manila") {
  const parts = businessDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
