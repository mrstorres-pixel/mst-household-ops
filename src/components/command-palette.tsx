"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";

type SearchRow = Record<string, unknown>;
type SearchResults = {
  customers: SearchRow[];
  suppliers: SearchRow[];
  items: SearchRow[];
  invoices: SearchRow[];
  supplierInvoices: SearchRow[];
  cheques: SearchRow[];
  payments: SearchRow[];
};

const emptyResults: SearchResults = {
  customers: [],
  suppliers: [],
  items: [],
  invoices: [],
  supplierInvoices: [],
  cheques: [],
  payments: []
};

function relationName(value: unknown) {
  if (Array.isArray(value)) return String((value[0] as SearchRow | undefined)?.name ?? "");
  if (value && typeof value === "object" && "name" in value) return String((value as SearchRow).name ?? "");
  return "";
}

function sectionRows(results: SearchResults) {
  return [
    {
      title: "Customer invoices",
      rows: results.invoices.map((row) => ({
        id: String(row.id),
        label: String(row.invoice_number ?? "Invoice"),
        detail: `${relationName(row.customers)} · ${money(row.total as number | string | null | undefined)}`,
        href: `/invoices/${row.id}/edit`
      }))
    },
    {
      title: "Customers",
      rows: results.customers.map((row) => ({
        id: String(row.id),
        label: String(row.name ?? "Customer"),
        detail: String(row.account_code ?? row.phone ?? ""),
        href: `/customers/${row.id}`
      }))
    },
    {
      title: "Items",
      rows: results.items.map((row) => ({
        id: String(row.id),
        label: String(row.name ?? "Item"),
        detail: `SKU ${row.sku ?? "-"} · Stock ${row.current_quantity ?? 0}`,
        href: `/inventory/${row.id}`
      }))
    },
    {
      title: "Suppliers",
      rows: results.suppliers.map((row) => ({
        id: String(row.id),
        label: String(row.name ?? "Supplier"),
        detail: String(row.contact_name ?? row.phone ?? ""),
        href: "/suppliers"
      }))
    },
    {
      title: "Supplier invoices",
      rows: results.supplierInvoices.map((row) => ({
        id: String(row.id),
        label: String(row.supplier_invoice_number ?? String(row.id).slice(0, 8)),
        detail: `${row.supplier_name ?? ""} · ${money(row.total as number | string | null | undefined)}`,
        href: `/suppliers/invoices/${row.id}`
      }))
    },
    {
      title: "Cheques and payments",
      rows: [
        ...results.cheques.map((row) => ({
          id: `cheque-${row.id}`,
          label: String(row.cheque_number ?? "Cheque"),
          detail: `${relationName(row.customers)} · ${money(row.amount as number | string | null | undefined)} · ${row.status ?? ""}`,
          href: "/cheques"
        })),
        ...results.payments.map((row) => ({
          id: `payment-${row.id}`,
          label: String(row.reference ?? "Payment"),
          detail: `${relationName(row.customers)} · ${row.method ?? ""} · ${money(row.amount as number | string | null | undefined)}`,
          href: "/payments"
        }))
      ]
    }
  ].filter((section) => section.rows.length);
}

export function CommandPalette({
  showTrigger = true,
  triggerClassName = "btn btn-secondary w-full"
}: {
  showTrigger?: boolean;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sections = useMemo(() => sectionRows(results), [results]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = await response.json();
        setResults(payload.results ?? emptyResults);
      } catch {
        if (!controller.signal.aborted) setResults(emptyResults);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isOpen, query]);

  return (
    <>
      {showTrigger ? (
        <button className={triggerClassName} type="button" onClick={() => setIsOpen(true)}>
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Command Search</span>
          <span className="command-palette-shortcut" aria-hidden="true">Ctrl K</span>
        </button>
      ) : null}
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/55 p-3 pt-16 backdrop-blur-sm md:place-items-center md:p-4" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl" role="dialog" aria-modal="true" aria-label="Command search" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-[color:var(--border)] p-3">
              <Search className="h-5 w-5 text-[color:var(--muted-foreground)]" aria-hidden="true" />
              <input
                ref={inputRef}
                className="min-h-11 flex-1 bg-transparent text-base outline-none"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!event.target.value.trim()) {
                    setResults(emptyResults);
                    setIsLoading(false);
                  }
                }}
                placeholder="Search invoice, customer, item, supplier, cheque..."
              />
              <button className="btn btn-secondary min-h-9 px-3" type="button" onClick={() => setIsOpen(false)} aria-label="Close command search">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {!query.trim() ? <p className="p-4 text-sm text-[color:var(--muted-foreground)]">Press Ctrl/⌘ K anywhere to open this search.</p> : null}
              {isLoading ? <p className="p-4 text-sm font-semibold text-[color:var(--muted-foreground)]">Searching...</p> : null}
              {!isLoading && query.trim() && !sections.length ? <p className="p-4 text-sm text-[color:var(--muted-foreground)]">No matching records.</p> : null}
              <div className="grid gap-4">
                {sections.map((section) => (
                  <section key={section.title}>
                    <h3 className="px-2 pb-2 text-xs font-bold uppercase text-[color:var(--muted-foreground)]">{section.title}</h3>
                    <div className="grid gap-1">
                      {section.rows.map((row) => (
                        <Link className="rounded-lg px-3 py-2 hover:bg-[color:var(--muted)]" href={row.href} key={row.id} onClick={() => setIsOpen(false)}>
                          <span className="block font-bold text-[color:var(--primary)]">{row.label}</span>
                          {row.detail ? <span className="block text-sm text-[color:var(--muted-foreground)]">{row.detail}</span> : null}
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
