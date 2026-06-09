"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

type NavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  variant?: "sidebar" | "mobile" | "quick" | "bottom";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ href, label, icon: Icon, variant = "sidebar" }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  if (variant === "quick" || variant === "bottom") {
    const isQuick = variant === "quick";
    return (
      <Link
        href={href}
        className={clsx(
          "grid min-h-14 place-items-center gap-1 rounded-lg px-2 py-1 text-center text-[0.7rem] font-bold",
          isQuick
            ? active ? "bg-white/18 text-white" : "border border-white/10 bg-white/8 text-[#f7f7f4]"
            : active ? "bg-[#14532d] text-white" : "text-[color:var(--muted-foreground)]"
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  }

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        className={clsx(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#f7f7f4] hover:bg-white/10",
          active && "bg-white/15"
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={clsx(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#f7f7f4] hover:bg-white/10 lg:gap-3",
        active && "bg-white/15 shadow-inner"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
