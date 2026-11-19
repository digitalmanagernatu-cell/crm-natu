"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalidadBadge, EstadoBadge } from "@/components/ui";
import { fecha } from "@/lib/format";
import { CALIDADES, CANALES, ESTADOS, GRUPOS, type Cliente } from "@/lib/types";

export type Fila = Cliente & { responsableNombre: string; ultima: string; numProyectos: number };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ClientesTable({ filas, mostrarGrupo, responsables }: { filas: Fila[]; mostrarGrupo: boolean; responsables: { value: string; label: string }[] }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ estado: "", calidad: "", canal: "", grupo: "", resp: "", tipo: "" });
  const [orden, setOrden] = useState<"ultima" | "nombre" | "alta">("ultima");

  const vista = useMemo(() => {
    const nq = norm(q);
    return filas
      .filter((c) =>
        (!nq || norm([c.nombre, c.zona, c.contacto, c.email, c.notas, c.responsableNombre].join(" ")).includes(nq)) &&
        (!f.estado || c.estado === f.estado) && (!f.calidad || c.calidad === f.calidad) && (!f.canal || c.canal === f.canal) &&
        (!f.grupo || c.grupo === f.grupo) && (!f.resp || c.responsable === (f.resp === "sin-asignar" ? "" : f.resp)) &&
        (!f.tipo || (f.tipo === "clientes" ? c.estado === "Ganado" : c.estado !== "Ganado")))
      .sort((a, b) => (orden === "nombre" ? a.nombre.localeCompare(b.nombre) : orden === "alta" ? b.fechaAlta.localeCompare(a.fechaAlta) : b.ultima.localeCompare(a.ultima)));
  }, [filas, q, f, orden]);

  const sel = (k: keyof typeof f, label: string, opts: readonly string[] | { value: string; label: string }[]) => (
    <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input w-auto">
      <option value="">{label}</option>
      {opts.map((o) => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, país, contacto, email…" className="input pl-9" />
        </div>
        {sel("tipo", "Prospectos y clientes", [{ value: "prospectos", label: "Solo prospectos" }, { value: "clientes", label: "Solo clientes (ganados)" }])}
        {sel("estado", "Estado", ESTADOS)}
        {sel("calidad", "Calidad", CALIDADES)}
        {sel("canal", "Canal", CANALES)}
        {mostrarGrupo && sel("grupo", "Grupo", GRUPOS)}
        {responsables.length > 1 && sel("resp", "Comercial", responsables)}
        <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="input w-auto">
          <option value="ultima">Orden: última actividad</option>
          <option value="alta">Orden: más recientes</option>
          <option value="nombre">Orden: A-Z</option>
        </select>
      </div>
      <div className="mb-2 text-xs text-muted">{vista.length} de {filas.length}</div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-2">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Calidad</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              {mostrarGrupo && <th className="px-4 py-3 font-medium">Grupo</th>}
              <th className="px-4 py-3 font-medium">Comercial</th>
              <th className="px-4 py-3 font-medium">Próxima acción</th>
              <th className="px-4 py-3 font-medium">Última actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vista.map((c) => (
              <tr key={c.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:text-accent">{c.nombre}</Link>
                  <div className="text-xs text-muted">{[c.zona, c.contacto].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-4 py-3"><EstadoBadge estado={c.estado} />{c.numProyectos > 0 && <span className="ml-1 text-xs text-muted">{c.numProyectos} proy.</span>}</td>
                <td className="px-4 py-3"><CalidadBadge calidad={c.calidad} /></td>
                <td className="px-4 py-3 text-ink-2">{c.canal || "—"}</td>
                {mostrarGrupo && <td className="px-4 py-3 text-ink-2">{c.grupo}</td>}
                <td className="px-4 py-3 text-ink-2">{c.responsableNombre}</td>
                <td className="px-4 py-3 text-ink-2">
                  {c.proximaAccion || "—"}
                  {c.fechaProximaAccion && <div className={`text-xs ${c.fechaProximaAccion < new Date().toISOString().slice(0, 10) ? "text-[var(--bad)]" : "text-muted"}`}>{fecha(c.fechaProximaAccion)}</div>}
                </td>
                <td className="px-4 py-3 text-ink-2">{fecha(c.ultima)}</td>
              </tr>
            ))}
            {vista.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No hay resultados con esos filtros</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
