"use client";
import { clsx } from "clsx";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, List, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { cancelar, marcarHecha, nuevaTarea, reprogramar } from "@/lib/actions";
import { TIPOS_ACCION, type Tarea } from "@/lib/types";

export type ItemAgenda = Tarea & { clienteNombre: string; responsableNombre: string; clienteEstado: string };
type Opcion = { value: string; label: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const masDias = (base: string, n: number) => { const d = new Date(`${base}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const largo = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const corto = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const orden = (a: ItemAgenda, b: ItemAgenda) => `${a.fecha}${a.hora || "99"}`.localeCompare(`${b.fecha}${b.hora || "99"}`);

const TIPO_COLOR: Record<string, string> = {
  Llamada: "bg-sky-50 text-sky-800 ring-sky-200", Email: "bg-slate-100 text-slate-700 ring-slate-300",
  Reunión: "bg-[#eef0e6] text-[#56613f] ring-[#d3d7c4]", Visita: "bg-[#fbecea] text-[#9a4a3e] ring-[#e2a29a]",
  "Muestra enviada": "bg-[#fbf3ec] text-[#8a5a3f] ring-[#e4bca5]", Oferta: "bg-violet-50 text-violet-800 ring-violet-200", Nota: "bg-slate-100 text-slate-700 ring-slate-300",
};

export function AgendaFila({ t, hoy, compacto = false }: { t: ItemAgenda; hoy: string; compacto?: boolean }) {
  const [modo, setModo] = useState<"" | "hecha" | "fecha" | "cancelar">("");
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(t.fecha);
  const [hora, setHora] = useState(t.hora);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) => start(async () => { try { setError(""); await fn(); setModo(""); setTexto(""); } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido guardar"); } });
  const vencida = t.estado === "Pendiente" && t.fecha < hoy;
  const cerrada = t.estado !== "Pendiente";
  return (
    <div className={clsx("rounded-lg bg-white px-3 py-2.5 ring-1", vencida ? "ring-rose-200" : "ring-slate-200", cerrada && "opacity-60")}>
      <div className="flex items-start gap-3">
        <button type="button" title={cerrada ? t.estado : "Marcar como hecha"} disabled={cerrada || pending} onClick={() => setModo(modo === "hecha" ? "" : "hecha")}
          className={clsx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1", t.estado === "Hecha" ? "bg-[#56613f] text-white ring-[#56613f]" : t.estado === "Cancelada" ? "bg-slate-200 text-slate-500 ring-slate-300" : "ring-slate-400 hover:bg-brand-50 hover:ring-brand-500")}>
          {t.estado === "Hecha" && <Check className="size-3.5" />}{t.estado === "Cancelada" && <X className="size-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={clsx("rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1", TIPO_COLOR[t.tipo])}>{t.tipo}</span>
            <span className={clsx("font-medium text-slate-900", t.estado === "Hecha" && "line-through")}>{t.titulo}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <Link href={`/clientes/${t.clienteId}`} className="font-medium text-brand-500 hover:underline">{t.clienteNombre}</Link>
            {!compacto && <span className={vencida ? "font-medium text-rose-700" : ""}>· {corto(t.fecha)}</span>}
            {t.hora && <span className="inline-flex items-center gap-0.5">· <Clock className="size-3" />{t.hora}</span>}
            <span>· {t.responsableNombre}</span>
            {vencida && <span className="font-medium text-rose-700">· Vencida</span>}
          </div>
          {t.notas && <p className="mt-1 text-xs text-slate-600">{t.notas}</p>}
          {t.resultado && <p className="mt-1 text-xs text-slate-600">{t.estado === "Hecha" ? "Resultado" : "Motivo"}: {t.resultado}</p>}
        </div>
        {!cerrada && !compacto && (
          <div className="flex shrink-0 gap-1 text-xs">
            <button type="button" className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => setModo(modo === "fecha" ? "" : "fecha")}>Reprogramar</button>
            <button type="button" className="rounded px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => setModo(modo === "cancelar" ? "" : "cancelar")}>Cancelar</button>
          </div>
        )}
      </div>
      {modo === "hecha" && (
        <form className="mt-2 flex flex-wrap gap-2 pl-8" onSubmit={(e) => { e.preventDefault(); run(() => marcarHecha(t.id, texto)); }}>
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué ha pasado? (se apunta en la bitácora)" className="input flex-1 py-1.5" />
          <button disabled={pending} className="btn-primary py-1.5"><Check className="size-4" /> Hecha</button>
        </form>
      )}
      {modo === "fecha" && (
        <form className="mt-2 flex flex-wrap gap-2 pl-8" onSubmit={(e) => { e.preventDefault(); run(() => reprogramar(t.id, fecha, hora)); }}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input w-auto py-1.5" required />
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input w-auto py-1.5" />
          <button disabled={pending} className="btn-primary py-1.5">Guardar</button>
        </form>
      )}
      {modo === "cancelar" && (
        <form className="mt-2 flex flex-wrap gap-2 pl-8" onSubmit={(e) => { e.preventDefault(); run(() => cancelar(t.id, texto)); }}>
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Motivo (opcional)" className="input flex-1 py-1.5" />
          <button disabled={pending} className="btn bg-rose-600 py-1.5 text-white hover:bg-rose-700">Cancelar acción</button>
        </form>
      )}
      {error && <p className="mt-1 pl-8 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function NuevaTareaForm({ clientes, asignables, yo, clienteFijo, onDone }: { clientes: Opcion[]; asignables: Opcion[]; yo: string; clienteFijo?: string; onDone?: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2 sm:grid-cols-6" action={(f) => start(async () => { try { setError(""); await nuevaTarea(f); onDone?.(); } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido guardar"); } })}>
      {clienteFijo ? <input type="hidden" name="clienteId" value={clienteFijo} /> : (
        <select name="clienteId" required className="input sm:col-span-3" defaultValue="">
          <option value="" disabled>Cliente o prospecto…</option>
          {clientes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
      <select name="tipo" className={clsx("input", clienteFijo ? "sm:col-span-2" : "sm:col-span-3")} defaultValue="Llamada">{TIPOS_ACCION.map((t) => <option key={t}>{t}</option>)}</select>
      <input name="titulo" required placeholder="Qué hay que hacer" className={clsx("input", clienteFijo ? "sm:col-span-4" : "sm:col-span-6")} />
      <input name="fecha" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input sm:col-span-2" />
      <input name="hora" type="time" className="input sm:col-span-2" />
      {asignables.length > 1 ? (
        <select name="responsable" className="input sm:col-span-2" defaultValue={clienteFijo ? "" : yo}>
          {clienteFijo && <option value="">Propietario del cliente</option>}
          {asignables.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      ) : <span className="sm:col-span-2" />}
      <input name="notas" placeholder="Notas (opcional)" className="input sm:col-span-4" />
      <button disabled={pending} className="btn-primary justify-center sm:col-span-2"><Plus className="size-4" /> Programar</button>
      {error && <p className="text-sm text-rose-700 sm:col-span-6">{error}</p>}
    </form>
  );
}

export function AgendaView({ items, personas, clientes, asignables, yo, verEquipo }: {
  items: ItemAgenda[]; personas: Opcion[]; clientes: Opcion[]; asignables: Opcion[]; yo: string; verEquipo: boolean;
}) {
  const hoy = iso(new Date());
  const [vista, setVista] = useState<"lista" | "semana">("lista");
  const [persona, setPersona] = useState(verEquipo ? "" : yo);
  const [tipo, setTipo] = useState("");
  const [cerradas, setCerradas] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [lunes, setLunes] = useState(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); });

  const filtradas = useMemo(() => items.filter((t) => (!persona || t.responsable === persona) && (!tipo || t.tipo === tipo)).sort(orden), [items, persona, tipo]);
  const pendientes = filtradas.filter((t) => t.estado === "Pendiente");
  const finSemana = masDias(hoy, 7 - ((new Date().getDay() + 6) % 7));
  const grupos: [string, ItemAgenda[], string?][] = [
    ["Vencidas", pendientes.filter((t) => t.fecha < hoy), "text-rose-700"],
    [`Hoy · ${largo(hoy)}`, pendientes.filter((t) => t.fecha === hoy)],
    ["Mañana", pendientes.filter((t) => t.fecha === masDias(hoy, 1))],
    ["Resto de la semana", pendientes.filter((t) => t.fecha > masDias(hoy, 1) && t.fecha < finSemana)],
    ["Más adelante", pendientes.filter((t) => t.fecha >= finSemana && t.fecha > masDias(hoy, 1))],
  ];
  const hechas = filtradas.filter((t) => t.estado !== "Pendiente").sort((a, b) => b.completada.localeCompare(a.completada)).slice(0, 30);
  const dias = Array.from({ length: 7 }, (_, i) => masDias(lunes, i));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md shadow-sm ring-1 ring-slate-300">
          {([["lista", List, "Lista"], ["semana", CalendarDays, "Semana"]] as const).map(([k, Icon, l]) => (
            <button key={k} type="button" onClick={() => setVista(k)} aria-pressed={vista === k}
              className={clsx("inline-flex items-center gap-1.5 px-3 py-2 text-sm", k === "semana" && "border-l border-slate-300", vista === k ? "bg-brand-50 font-medium text-brand-500" : "bg-white text-slate-600 hover:bg-slate-50")}>
              <Icon className="size-4" /> {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNueva(!nueva)} className="btn-primary"><Plus className="size-4" /> Programar acción</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {verEquipo && (
            <select value={persona} onChange={(e) => setPersona(e.target.value)} className="input w-auto">
              <option value="">Todo el equipo</option>
              <option value={yo}>Mis acciones</option>
              {personas.filter((p) => p.value !== yo).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          )}
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-auto">
            <option value="">Todos los tipos</option>
            {TIPOS_ACCION.map((t) => <option key={t}>{t}</option>)}
          </select>
          {vista === "lista" && <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={cerradas} onChange={(e) => setCerradas(e.target.checked)} /> Ver hechas</label>}
        </div>
      </div>

      {nueva && <div className="card mb-4 p-4"><NuevaTareaForm clientes={clientes} asignables={asignables} yo={yo} onDone={() => setNueva(false)} /></div>}

      {vista === "lista" ? (
        <div className="space-y-5">
          {pendientes.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">No hay acciones pendientes{persona === yo ? " para ti" : ""}. Prográmalas desde aquí, desde la ficha de un cliente o pidiéndoselo a Alexia.</div>}
          {grupos.filter(([, l]) => l.length).map(([titulo, lista, color]) => (
            <section key={titulo}>
              <h2 className={clsx("mb-2 text-xs font-semibold uppercase tracking-wide", color ?? "text-slate-500")}>{titulo} <span className="font-normal">({lista.length})</span></h2>
              <div className="space-y-2">{lista.map((t) => <AgendaFila key={t.id} t={t} hoy={hoy} />)}</div>
            </section>
          ))}
          {cerradas && hechas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hechas y canceladas recientes</h2>
              <div className="space-y-2">{hechas.map((t) => <AgendaFila key={t.id} t={t} hoy={hoy} />)}</div>
            </section>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <button className="btn-ghost px-2" onClick={() => setLunes(masDias(lunes, -7))} aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
            <button className="btn-ghost" onClick={() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setLunes(iso(d)); }}>Esta semana</button>
            <button className="btn-ghost px-2" onClick={() => setLunes(masDias(lunes, 7))} aria-label="Semana siguiente"><ChevronRight className="size-4" /></button>
            <span className="ml-2 text-sm font-medium text-slate-700">{corto(dias[0]!)} – {corto(dias[6]!)}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-7">
            {dias.map((dia) => {
              const del = filtradas.filter((t) => t.fecha === dia && t.estado !== "Cancelada");
              return (
                <div key={dia} className={clsx("min-h-40 rounded-xl border bg-white p-2", dia === hoy ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200")}>
                  <div className={clsx("mb-2 text-xs font-semibold capitalize", dia === hoy ? "text-brand-500" : "text-slate-500")}>{corto(dia)}</div>
                  <div className="space-y-1.5">{del.map((t) => <AgendaFila key={t.id} t={t} hoy={hoy} compacto />)}</div>
                </div>
              );
            })}
          </div>
          {filtradas.some((t) => t.estado === "Pendiente" && t.fecha < hoy) && <p className="mt-3 text-sm text-rose-700">Hay acciones vencidas de semanas anteriores: míralas en la vista Lista.</p>}
        </div>
      )}
    </div>
  );
}
