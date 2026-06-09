"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ResponsiveTables() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tables = Array.from(document.querySelectorAll<HTMLTableElement>(".table-wrap table"));
    for (const table of tables) {
      const hasFormControls = Boolean(table.querySelector("input, select, textarea"));
      table.dataset.mobile = hasFormControls ? "scroll" : "cards";
      const headers = Array.from(table.querySelectorAll("thead th")).map((header) => header.textContent?.trim() ?? "");
      for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
        Array.from(row.children).forEach((cell, index) => {
          if (cell instanceof HTMLElement && headers[index]) {
            cell.dataset.label = headers[index];
          }
        });
      }
    }
  }, [pathname, searchParams]);

  return null;
}
