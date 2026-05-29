import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, detail, icon: Icon }: StatCardProps) {
  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          {detail ? <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{detail}</p> : null}
        </div>
        <Icon className="h-5 w-5 text-[color:var(--accent)]" aria-hidden="true" />
      </div>
    </section>
  );
}
