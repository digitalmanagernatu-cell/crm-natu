"use client";
import { Calendar, FileText, Mail, MapPin, MessageSquare, Package, Phone, Settings, Users } from "lucide-react";
import { useState } from "react";
import { fechaHora } from "@/lib/format";
import { TIPOS_ACCION, type Accion, type TipoAccion } from "@/lib/types";

const ICON: Record<TipoAccion, React.ComponentType<{ size?: number }>> = {
  Llamada: Phone, Email: Mail, Reunión: Users, Visita: MapPin, "Muestra enviada": Package, Oferta: FileText, Nota: MessageSquare, Sistema: Settings,
};

export function Bitacora({ acciones }: { acciones: (Accion & { autorNombre: string })[] }) {
  const [tipo, setTipo] = useState("");
  const [sistema, setSistema] = useState(true);
  const lista = acciones.filter((a) => (!tipo || a.tipo === tipo) && (sistema || a.tipo !== "Sistema"));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-auto">
          <option value="">Todas las acciones</option>
          {TIPOS_ACCION.map((t) => <option key={t}>{t}</option>)}
          <option>Sistema</option>
        </select>
        <label className="flex items-center gap-1.5 text-ink-2"><input type="checkbox" checked={sistema} onChange={(e) => setSistema(e.target.checked)} /> Mostrar cambios automáticos</label>
        <span className="ml-auto text-xs text-muted">{lista.length} entradas</span>
      </div>
      {lista.length === 0 && <p className="py-6 text-center text-sm text-muted">Aún no hay acciones registradas.</p>}
      <ol className="relative space-y-4 border-l border-line pl-6">
        {lista.map((a) => {
          const Icon = ICON[a.tipo] ?? Calendar;
          const sys = a.tipo === "Sistema";
          return (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border border-line ${sys ? "bg-surface-2 text-muted" : "bg-surface text-accent"}`}>
                <Icon size={14} />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                <span className={`font-semibold ${sys ? "" : "text-ink"}`}>{a.tipo}</span>
                <span>{fechaHora(a.fecha)}</span>
                <span>· {a.autorNombre}</span>
              </div>
              <p className={`mt-1 whitespace-pre-wrap text-sm ${sys ? "text-ink-2" : ""}`}>{a.comentario}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
