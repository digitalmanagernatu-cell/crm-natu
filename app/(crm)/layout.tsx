import { LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { devLogin, signOut } from "@/auth";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { assistantEnabled } from "@/lib/ai";
import { datosVisibles } from "@/lib/session";
import { ROL_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { usuario: u, datos } = await datosVisibles();
  const hoy = new Date().toISOString().slice(0, 10);
  const avisosAgenda = datos.agenda.filter((t) => t.responsable === u.email && t.estado === "Pendiente" && t.fecha <= hoy).length;
  return (
    <div className="flex min-h-dvh flex-col">
      {devLogin && (
        <div className="bg-amber-400 px-4 py-1 text-center text-xs font-medium text-amber-950">
          Modo pruebas: acceso sin Microsoft. No lo actives en producción.
        </div>
      )}
      <header className="sticky top-0 z-30 bg-natu-dark text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <Link href="/" className="shrink-0"><Logo onDark /></Link>
          <Nav admin={u.rol === "admin"} avisosAgenda={avisosAgenda} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link href="/clientes/nuevo" className="inline-flex items-center gap-1.5 rounded-md bg-natu-sage px-2.5 py-1.5 text-sm font-semibold text-natu-dark shadow-sm hover:bg-brand-300 sm:px-3" title="Nuevo prospecto">
              <Plus className="size-4" aria-hidden /> <span className="hidden lg:inline">Nuevo prospecto</span>
            </Link>
            <details className="relative">
              <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full bg-white/15 text-xs font-semibold hover:bg-white/25" title={u.nombre}>
                {iniciales(u.nombre)}
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white p-3 text-sm text-slate-700 shadow-lg ring-1 ring-slate-200">
                <p className="font-medium text-slate-900">{u.nombre}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
                <p className="mt-2 text-xs text-slate-500">{ROL_LABEL[u.rol]} · {u.grupo}</p>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                  <button type="submit" className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50">
                    <LogOut className="size-4" aria-hidden /> Cerrar sesión
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6">{children}</main>
      {/* Alexia (solo si está configurada la clave de la API de OpenAI) */}
      {assistantEnabled() && <AssistantWidget firstName={u.nombre.split(" ")[0] ?? u.nombre} />}
    </div>
  );
}
