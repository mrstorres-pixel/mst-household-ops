import { clsx } from "clsx";

const toneClass = {
  neutral: "badge-neutral",
  good: "badge-good",
  warning: "badge-warning",
  danger: "badge-danger"
};

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClass;
}) {
  return <span className={clsx("badge", toneClass[tone])}>{children}</span>;
}
