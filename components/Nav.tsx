"use client";
import { clsx } from "clsx";
import { Bot, LayoutDashboard, Users, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/asistente", label: "Asistente IA", icon: Bot },
    ...(admin ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
  ];
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={clsx("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2")}>
            <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
