import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, detail, icon: Icon }: StatCardProps) {
  return (
    <section className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">{title}</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight md:text-2xl">{value}</p>
          {detail ? <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail}</p> : null}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff7ed] text-[color:var(--accent)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}
