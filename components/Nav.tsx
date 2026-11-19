"use client";
import { clsx } from "clsx";
import { Briefcase, CalendarCheck, LayoutDashboard, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ admin, avisosAgenda = 0 }: { admin: boolean; avisosAgenda?: number }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/prospectos", label: "Prospectos", icon: Users },
    { href: "/clientes", label: "Clientes", icon: Briefcase },
    { href: "/agenda", label: "Agenda", icon: CalendarCheck, badge: avisosAgenda },
    ...(admin ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
  ];
  return (
    <nav className="ml-1 flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm sm:ml-4 sm:gap-1">
      {items.map(({ href, label, icon: Icon, ...rest }) => {
        const badge = "badge" in rest ? (rest.badge as number) : 0;
        const active = href === "/" ? path === "/" : href === "/clientes" ? path === "/clientes" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} title={label}
            className={clsx("inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 sm:px-3", active ? "bg-white/15 font-semibold" : "text-white/85 hover:bg-white/10")}>
            <Icon className="hidden size-4 sm:block" aria-hidden /> <span className="whitespace-nowrap">{label}</span>
            {badge > 0 && <span className="ml-0.5 rounded-full bg-natu-salmon px-1.5 text-[11px] font-bold text-natu-dark" title={`${badge} acciones para hoy o vencidas`}>{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
