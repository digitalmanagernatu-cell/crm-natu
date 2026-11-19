import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Nav } from "@/components/Nav";
import { requireUsuario } from "@/lib/session";
import { ROL_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUsuario();
  return (
    <div className="md:flex">
      <aside className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface p-3 md:h-screen md:w-56 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:p-4">
        <div className="md:mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">Natu</div>
          <div className="text-lg font-semibold leading-tight">CRM</div>
        </div>
        <Nav admin={u.rol === "admin"} />
        <div className="hidden md:mt-auto md:block">
          <div className="text-sm font-medium">{u.nombre}</div>
          <div className="text-xs text-muted">{ROL_LABEL[u.rol]} · {u.grupo}</div>
          <form className="mt-3" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink"><LogOut size={14} /> Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</main>
    </div>
  );
}
