"use client";
import { clsx } from "clsx";
import { Briefcase, LayoutDashboard, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/prospectos", label: "Prospectos", icon: Users },
    { href: "/clientes", label: "Clientes", icon: Briefcase },
    ...(admin ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
  ];
  return (
    <nav className="ml-1 flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm sm:ml-4 sm:gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : href === "/clientes" ? path === "/clientes" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} title={label}
            className={clsx("inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 sm:px-3", active ? "bg-white/15 font-semibold" : "text-white/85 hover:bg-white/10")}>
            <Icon className="hidden size-4 sm:block" aria-hidden /> <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
