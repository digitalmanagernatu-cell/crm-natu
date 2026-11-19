"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { type ItemAgenda, AgendaFila, NuevaTareaForm } from "./AgendaView";

/** Agenda dentro de la ficha de un cliente: pendientes + programar una nueva. */
export function AgendaCliente({ clienteId, items, asignables, yo }: { clienteId: string; items: ItemAgenda[]; asignables: { value: string; label: string }[]; yo: string }) {
  const [nueva, setNueva] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);
  const pendientes = items.filter((t) => t.estado === "Pendiente").sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Agenda</div>
        <div className="flex items-center gap-3">
          <Link href="/agenda" className="text-xs text-brand-500 hover:underline">Ver agenda</Link>
          <button type="button" onClick={() => setNueva(!nueva)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"><Plus className="size-3.5" /> Programar</button>
        </div>
      </div>
      {nueva && <div className="mb-3"><NuevaTareaForm clientes={[]} asignables={asignables} yo={yo} clienteFijo={clienteId} onDone={() => setNueva(false)} /></div>}
      {pendientes.length === 0 ? <p className="text-sm text-slate-500">No hay acciones programadas.</p> : (
        <div className="space-y-2">{pendientes.map((t) => <AgendaFila key={t.id} t={t} hoy={hoy} />)}</div>
      )}
    </div>
  );
}
