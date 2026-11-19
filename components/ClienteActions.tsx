"use client";
import { Trophy, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { anadirAccion, anadirProyecto, cambiarEstado, marcarGanado } from "@/lib/actions";
import { ESTADOS, ESTADOS_PROYECTO, TIPOS_ACCION, type Estado } from "@/lib/types";

function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={className}>{pending ? "Guardando…" : children}</button>;
}

/** Envuelve una server action: resetea el formulario y muestra errores. */
function useAccion(fn: (f: FormData) => Promise<void>, onOk?: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const action = async (f: FormData) => {
    setError("");
    try { await fn(f); ref.current?.reset(); onOk?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al guardar"); }
  };
  return { ref, action, error };
}

const hoy = () => new Date().toISOString().slice(0, 10);

export function EstadoSelect({ clienteId, estado }: { clienteId: string; estado: Estado }) {
  const [pending, start] = useTransition();
  if (estado === "Ganado") return null;
  return (
    <select disabled={pending} value={estado} className="input w-auto"
      onChange={(e) => start(() => cambiarEstado(clienteId, e.target.value))}>
      {ESTADOS.filter((e) => e !== "Ganado").map((e) => <option key={e}>{e}</option>)}
    </select>
  );
}

export function GanadoButton({ clienteId }: { clienteId: string }) {
  const [open, setOpen] = useState(false);
  const { ref, action, error } = useAccion(marcarGanado.bind(null, clienteId), () => setOpen(false));
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn bg-[var(--good)] text-white hover:opacity-90"><Trophy size={16} /> Pasar a Ganado</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <form ref={ref} action={action} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4 p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">🎉 Pasar a Ganado</h2>
                <p className="text-sm text-ink-2">Se ha firmado el primer contrato. Registra el primer proyecto.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted"><X size={18} /></button>
            </div>
            <div><label className="label">Nombre del proyecto</label><input name="nombre" placeholder="Primer proyecto" className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Importe (€) · opcional</label><input name="importe" inputMode="decimal" placeholder="0" className="input" /></div>
              <div><label className="label">Fecha de firma</label><input name="fecha" type="date" defaultValue={hoy()} className="input" /></div>
            </div>
            <div><label className="label">Notas</label><textarea name="notas" rows={2} className="input" /></div>
            {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
              <Submit>Confirmar</Submit>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function BitacoraForm({ clienteId }: { clienteId: string }) {
  const { ref, action, error } = useAccion(anadirAccion.bind(null, clienteId));
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select name="tipo" className="input w-auto">{TIPOS_ACCION.map((t) => <option key={t}>{t}</option>)}</select>
        <input name="fecha" type="date" defaultValue={hoy()} className="input w-auto" />
      </div>
      <textarea name="comentario" required rows={3} placeholder="¿Qué ha pasado? Llamada, feedback del cliente, acuerdos…" className="input" />
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2">Programar próxima acción</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input name="proximaAccion" placeholder="Próxima acción" className="input sm:col-span-2" />
          <input name="fechaProximaAccion" type="date" className="input" />
        </div>
      </details>
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      <div className="flex justify-end"><Submit>Añadir a la bitácora</Submit></div>
    </form>
  );
}

export function ProyectoForm({ clienteId }: { clienteId: string }) {
  const [open, setOpen] = useState(false);
  const { ref, action, error } = useAccion(anadirProyecto.bind(null, clienteId), () => setOpen(false));
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost w-full justify-center">+ Nuevo proyecto</button>;
  return (
    <form ref={ref} action={action} className="space-y-2 rounded-lg border border-line p-3">
      <input name="nombre" required placeholder="Nombre del proyecto" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="importe" inputMode="decimal" placeholder="Importe € (opcional)" className="input" />
        <input name="fecha" type="date" defaultValue={hoy()} className="input" />
      </div>
      <select name="estado" className="input">{ESTADOS_PROYECTO.map((e) => <option key={e}>{e}</option>)}</select>
      <textarea name="notas" rows={2} placeholder="Notas" className="input" />
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
        <Submit>Añadir</Submit>
      </div>
    </form>
  );
}
