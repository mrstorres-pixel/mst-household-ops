"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

function storageKey(pathname: string, name: string) {
  return `mst-filter:${pathname}:${name}`;
}

function serializeForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of data.entries()) {
    const text = String(value).trim();
    if (text) params.set(key, text);
  }
  return params.toString();
}

export function SavedFilterForms() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form[data-save-filters]"));
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-clear-saved-filter]"));
    if (!forms.length && !links.length) return;

    const cleanups: Array<() => void> = [];
    for (const form of forms) {
      const name = form.dataset.saveFilters || "default";
      const key = storageKey(pathname, name);

      if (!searchParams.toString()) {
        const saved = window.localStorage.getItem(key);
        if (saved) {
          router.replace(`${pathname}?${saved}`);
          return;
        }
      }

      const onSubmit = () => {
        const serialized = serializeForm(form);
        if (serialized) window.localStorage.setItem(key, serialized);
        else window.localStorage.removeItem(key);
      };
      form.addEventListener("submit", onSubmit);
      cleanups.push(() => form.removeEventListener("submit", onSubmit));
    }

    for (const link of links) {
      const name = link.dataset.clearSavedFilter || "default";
      const key = storageKey(pathname, name);
      const onClick = () => window.localStorage.removeItem(key);
      link.addEventListener("click", onClick);
      cleanups.push(() => link.removeEventListener("click", onClick));
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [pathname, router, searchParams]);

  return null;
}
