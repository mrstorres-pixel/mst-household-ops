"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Widget = {
  id: string;
  title: string;
  hidden: boolean;
};

const storageKey = "mst-dashboard-widgets";

function loadSaved() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as Array<{ id: string; hidden?: boolean }> : [];
  } catch {
    return [];
  }
}

export function DashboardWidgetControls({ initialWidgets }: { initialWidgets: Array<{ id: string; title: string }> }) {
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    if (typeof window === "undefined") return initialWidgets.map((widget) => ({ ...widget, hidden: false }));
    const saved = loadSaved();
    const savedById = new Map(saved.map((item, index) => [item.id, { ...item, index }]));
    const discovered = initialWidgets.map((widget) => ({
      ...widget,
      hidden: Boolean(savedById.get(widget.id)?.hidden)
    }));
    return [...discovered].sort((first, second) => {
      const firstIndex = savedById.get(first.id)?.index ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = savedById.get(second.id)?.index ?? Number.MAX_SAFE_INTEGER;
      return firstIndex - secondIndex;
    });
  });

  useEffect(() => {
    if (!widgets.length) return;
    window.localStorage.setItem(storageKey, JSON.stringify(widgets.map(({ id, hidden }) => ({ id, hidden }))));
    for (const [index, widget] of widgets.entries()) {
      const element = document.querySelector<HTMLElement>(`[data-dashboard-widget="${widget.id}"]`);
      if (!element) continue;
      element.style.order = String(index);
      element.hidden = widget.hidden;
    }
  }, [widgets]);

  const hiddenCount = useMemo(() => widgets.filter((widget) => widget.hidden).length, [widgets]);

  function move(id: string, direction: -1 | 1) {
    setWidgets((current) => {
      const index = current.findIndex((widget) => widget.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function toggle(id: string) {
    setWidgets((current) => current.map((widget) => widget.id === id ? { ...widget, hidden: !widget.hidden } : widget));
  }

  function reset() {
    window.localStorage.removeItem(storageKey);
    window.location.reload();
  }

  if (!widgets.length) return null;

  return (
    <details className="card mb-5 p-4">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 font-bold text-[color:var(--primary)]">
        <span>Dashboard Layout</span>
        <span className="text-xs uppercase text-[color:var(--muted-foreground)]">{hiddenCount ? `${hiddenCount} hidden` : "All visible"}</span>
      </summary>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((widget, index) => (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] p-2" key={widget.id}>
            <button className="btn btn-secondary min-h-9 px-3" type="button" onClick={() => toggle(widget.id)} aria-label={`${widget.hidden ? "Show" : "Hide"} ${widget.title}`}>
              {widget.hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
            <span className="min-w-0 flex-1 text-sm font-bold">{widget.title}</span>
            <div className="flex gap-1">
              <button className="btn btn-secondary min-h-9 px-3" type="button" disabled={index === 0} onClick={() => move(widget.id, -1)} aria-label={`Move ${widget.title} up`}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button className="btn btn-secondary min-h-9 px-3" type="button" disabled={index === widgets.length - 1} onClick={() => move(widget.id, 1)} aria-label={`Move ${widget.title} down`}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary mt-3" type="button" onClick={reset}>Reset Layout</button>
    </details>
  );
}
