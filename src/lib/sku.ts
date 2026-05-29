export function normalizeSku(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return normalized || null;
}
