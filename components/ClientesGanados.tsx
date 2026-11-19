"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { eur, fecha } from "@/lib/format";
import { parseTags, tagClass } from "@/lib/tags";
import type { Cliente } from "@/lib/types";

export type FilaCliente = Cliente & { responsableNombre: string; ultima: string; numProyectos: number; importe: number };
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ClientesGanados({ filas, mostrarGrupo }: { filas: FilaCliente[]; mostrarGrupo: boolean }) {
  const [q, setQ] = useState("");
  const lista = useMemo(() => {
    const nq = norm(q.trim());
    return filas.filter((c) => !nq || norm([c.nombre, c.zona, c.contacto, c.etiquetas, c.responsableNombre].join(" ")).includes(nq))
      .sort((a, b) => b.importe - a.importe || a.nombre.localeCompare(b.nombre));
  }, [filas, q]);
  const total = lista.reduce((s, c) => s + c.importe, 0);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="input pl-8" aria-label="Buscar" />
        </div>
        <span className="ml-auto text-sm text-slate-600">{lista.length} cliente{lista.length === 1 ? "" : "s"} · {eur(total)} en proyectos</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-700">
            <tr>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Etiquetas</th>
              {mostrarGrupo && <th className="px-3 py-2.5">Grupo</th>}
              <th className="px-3 py-2.5">Propietario</th>
              <th className="px-3 py-2.5">Ganado</th>
              <th className="px-3 py-2.5 text-right">Proyectos</th>
              <th className="px-3 py-2.5 text-right">Importe</th>
              <th className="px-3 py-2.5">Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2"><Link href={`/clientes/${c.id}`} className="font-medium hover:text-brand-500 hover:underline">{c.nombre}</Link><div className="text-xs text-slate-500">{c.zona}</div></td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{parseTags(c.etiquetas).map((t) => <span key={t} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ${tagClass(t)}`}>{t}</span>)}</div></td>
                {mostrarGrupo && <td className="px-3 py-2 text-slate-700">{c.grupo}</td>}
                <td className="px-3 py-2 text-slate-700">{c.responsableNombre}</td>
                <td className="px-3 py-2 text-slate-700">{fecha(c.fechaGanado)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.numProyectos}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{eur(c.importe)}</td>
                <td className="px-3 py-2 text-slate-700">{fecha(c.ultima)}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Todavía no hay clientes ganados. Se añaden aquí al pulsar «Pasar a Ganado» en un prospecto.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
