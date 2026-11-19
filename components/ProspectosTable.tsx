"use client";
import { clsx } from "clsx";
import { Archive, ArrowDown, ArrowUp, Check, ChevronDown, Filter, Inbox, MoreHorizontal, Plus, Search, Settings2, Tag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { accionMasiva } from "@/lib/actions";
import { fecha } from "@/lib/format";
import { parseTags, tagClass } from "@/lib/tags";
import { CALIDADES, CANALES, ESTADOS, GRUPOS, PRIORIDADES, type Cliente } from "@/lib/types";
import { EstadoBadge } from "./ui";

export type FilaProspecto = Cliente & { responsableNombre: string; ultima: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const fechaHoraCorta = (iso: string) => {
  if (!iso) return "—";
  if (iso.length === 10) return fecha(iso);
  const d = new Date(iso);
  return isNaN(+d) ? iso : `${d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};

type ColKey = "creado" | "titulo" | "etiquetas" | "calidad" | "prioridad" | "estado" | "origen" | "propietario" | "canal" | "zona" | "grupo" | "ultima" | "proxima";
const COLS: { key: ColKey; label: string; sort?: (c: FilaProspecto) => string; fija?: boolean; w?: string }[] = [
  { key: "creado", label: "Prospecto creado", sort: (c) => c.fechaAlta, w: "min-w-36" },
  { key: "titulo", label: "Título", sort: (c) => norm(c.nombre), fija: true, w: "min-w-48" },
  { key: "etiquetas", label: "Etiquetas", w: "min-w-40" },
  { key: "calidad", label: "Calidad", sort: (c) => c.calidad || "~", w: "min-w-28" },
  { key: "prioridad", label: "Prioridad", sort: (c) => ({ Alta: "1", Media: "2", Baja: "3" })[c.prioridad as string] ?? "9", w: "min-w-24" },
  { key: "estado", label: "Estado", sort: (c) => String(ESTADOS.indexOf(c.estado)), w: "min-w-32" },
  { key: "origen", label: "Origen", sort: (c) => norm(c.origen) || "~", w: "min-w-32" },
  { key: "propietario", label: "Propietario", sort: (c) => norm(c.responsableNombre), w: "min-w-32" },
  { key: "canal", label: "Canal", sort: (c) => c.canal || "~", w: "min-w-28" },
  { key: "zona", label: "Zona / País", sort: (c) => norm(c.zona) || "~", w: "min-w-28" },
  { key: "grupo", label: "Grupo", sort: (c) => c.grupo, w: "min-w-28" },
  { key: "ultima", label: "Última actividad", sort: (c) => c.ultima, w: "min-w-32" },
  { key: "proxima", label: "Próxima acción", sort: (c) => c.fechaProximaAccion || "9999", w: "min-w-40" },
];
const VISIBLES_DEF: ColKey[] = ["creado", "titulo", "etiquetas", "calidad", "prioridad", "estado", "origen", "propietario", "canal"];
const LS_COLS = "crm-prospectos-cols";
const PAGINA = 100;

function Chip({ t }: { t: string }) {
  return <span className={clsx("inline-flex max-w-40 truncate rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-tight ring-1", tagClass(t))} title={t}>{t}</span>;
}

/** Desplegable sencillo (sin dependencias). */
function Menu({ label, icon, children, align = "left", active = false, compact = false }: { label: React.ReactNode; icon?: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; active?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={clsx(compact ? "rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "btn-ghost", active && "ring-brand-500 bg-brand-50")}>
        {icon}{label}{!compact && <ChevronDown className="size-3.5 text-slate-500" aria-hidden />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={clsx("absolute z-40 mt-1 max-h-96 min-w-60 overflow-auto rounded-lg bg-white p-2 text-sm shadow-lg ring-1 ring-slate-200", align === "right" ? "right-0" : "left-0")}>
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

export function ProspectosTable({ filas, responsables, asignables, mostrarGrupo }: {
  filas: FilaProspecto[];
  responsables: { value: string; label: string }[];
  asignables: { value: string; label: string }[];
  mostrarGrupo: boolean;
}) {
  const [vista, setVista] = useState<"bandeja" | "archivo">("bandeja");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [f, setF] = useState({ estado: "", calidad: "", prioridad: "", canal: "", resp: "", grupo: "" });
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "creado", dir: -1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(PAGINA);
  const [cols, setCols] = useState<ColKey[]>(VISIBLES_DEF);
  const [pending, start] = useTransition();
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(LS_COLS) ?? "null"); if (Array.isArray(v)) setCols(v); } catch {}
  }, []);
  const toggleCol = (k: ColKey) => {
    const next = cols.includes(k) ? cols.filter((c) => c !== k) : COLS.map((c) => c.key).filter((c) => c === k || cols.includes(c));
    setCols(next);
    try { localStorage.setItem(LS_COLS, JSON.stringify(next)); } catch {}
  };

  const todasEtiquetas = useMemo(() => {
    const m = new Map<string, number>();
    filas.forEach((c) => parseTags(c.etiquetas).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filas]);

  const base = useMemo(() => filas.filter((c) => (vista === "archivo" ? c.estado === "Perdido" : c.estado !== "Perdido")), [filas, vista]);
  const lista = useMemo(() => {
    const nq = norm(q.trim());
    const col = COLS.find((c) => c.key === sort.key)!;
    return base
      .filter((c) =>
        (!nq || nq.split(/\s+/).every((w) => norm([c.nombre, c.zona, c.contacto, c.email, c.origen, c.etiquetas, c.responsableNombre].join(" ")).includes(w))) &&
        (!tag || parseTags(c.etiquetas).some((t) => t.toLowerCase() === tag.toLowerCase())) &&
        (!f.estado || c.estado === f.estado) && (!f.calidad || (f.calidad === "-" ? !c.calidad : c.calidad === f.calidad)) &&
        (!f.prioridad || (f.prioridad === "-" ? !c.prioridad : c.prioridad === f.prioridad)) &&
        (!f.canal || c.canal === f.canal) && (!f.grupo || c.grupo === f.grupo) &&
        (!f.resp || c.responsable === (f.resp === "sin-asignar" ? "" : f.resp)))
      .sort((a, b) => (col.sort ? col.sort(a).localeCompare(col.sort(b)) * sort.dir : 0));
  }, [base, q, tag, f, sort]);

  useEffect(() => { setSel(new Set()); setLimite(PAGINA); }, [vista, q, tag, f]);

  const filtrosActivos = Object.values(f).filter(Boolean).length;
  const visibles = COLS.filter((c) => c.fija || (cols.includes(c.key) && (c.key !== "grupo" || mostrarGrupo)));
  const todosSel = lista.length > 0 && lista.slice(0, limite).every((c) => sel.has(c.id));

  function masiva(op: Parameters<typeof accionMasiva>[1], valor = "", ids = [...sel]) {
    start(async () => {
      try {
        const n = await accionMasiva(ids, op, valor);
        setAviso(`${n} prospecto${n === 1 ? "" : "s"} actualizado${n === 1 ? "" : "s"}`);
        setSel(new Set());
      } catch (e) { setAviso(e instanceof Error ? e.message : "No se ha podido completar"); }
      setTimeout(() => setAviso(""), 3500);
    });
  }

  const celda = (c: FilaProspecto, k: ColKey) => {
    switch (k) {
      case "creado": return <span className="tabular-nums text-slate-700">{fechaHoraCorta(c.fechaAlta)}</span>;
      case "titulo": return <Link href={`/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-brand-500 hover:underline">{c.nombre}</Link>;
      case "etiquetas": return <div className="flex flex-wrap gap-1">{parseTags(c.etiquetas).map((t) => <Chip key={t} t={t} />)}</div>;
      case "calidad": return c.calidad || <span className="text-slate-400">—</span>;
      case "prioridad": return c.prioridad ? <span className={clsx("font-medium", c.prioridad === "Alta" ? "text-rose-700" : c.prioridad === "Media" ? "text-amber-700" : "text-slate-600")}>{c.prioridad}</span> : <span className="text-slate-400">—</span>;
      case "estado": return <EstadoBadge estado={c.estado} />;
      case "origen": return c.origen ? <span className="inline-block max-w-48 truncate rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700" title={c.origen}>{c.origen}</span> : <span className="text-slate-400">—</span>;
      case "propietario": return c.responsable ? c.responsableNombre : <span className="text-slate-400">Sin asignar</span>;
      case "canal": return c.canal || <span className="text-slate-400">—</span>;
      case "zona": return c.zona || <span className="text-slate-400">—</span>;
      case "grupo": return c.grupo;
      case "ultima": return fecha(c.ultima);
      case "proxima": return c.proximaAccion || c.fechaProximaAccion
        ? <span className={c.fechaProximaAccion && c.fechaProximaAccion < new Date().toISOString().slice(0, 10) ? "text-rose-700" : ""}>{c.proximaAccion || "Acción"}{c.fechaProximaAccion && ` · ${fecha(c.fechaProximaAccion)}`}</span>
        : <span className="text-slate-400">—</span>;
    }
  };

  const opt = (k: keyof typeof f, label: string, vals: readonly string[] | { value: string; label: string }[], sinValor?: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input py-1.5">
        <option value="">Todos</option>
        {sinValor && <option value="-">{sinValor}</option>}
        {vals.map((o) => (typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );

  return (
    <div>
      {/* Barra de herramientas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md shadow-sm ring-1 ring-slate-300">
          <button type="button" onClick={() => setVista("bandeja")} title="Bandeja de prospectos" aria-pressed={vista === "bandeja"}
            className={clsx("px-3 py-2", vista === "bandeja" ? "bg-brand-50 text-brand-500 ring-1 ring-brand-500" : "bg-white text-slate-600 hover:bg-slate-50")}><Inbox className="size-4" /></button>
          <button type="button" onClick={() => setVista("archivo")} title="Archivo (descartados / perdidos)" aria-pressed={vista === "archivo"}
            className={clsx("border-l border-slate-300 px-3 py-2", vista === "archivo" ? "bg-brand-50 text-brand-500 ring-1 ring-brand-500" : "bg-white text-slate-600 hover:bg-slate-50")}><Archive className="size-4" /></button>
        </div>
        <Link href="/clientes/nuevo" className="btn-primary"><Plus className="size-4" aria-hidden /> Prospecto</Link>
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prospecto, país, contacto, etiqueta…" className="input pl-8" aria-label="Buscar" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 tabular-nums">{lista.length.toLocaleString("es-ES")} prospecto{lista.length === 1 ? "" : "s"}{vista === "archivo" && " archivados"}</span>
          <Menu label={tag || "Todas las etiquetas"} icon={<Tag className="size-4" aria-hidden />} active={!!tag}>
            {(close) => (
              <div className="space-y-0.5">
                <button className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => { setTag(""); close(); }}>Todas las etiquetas</button>
                {todasEtiquetas.map(([t, n]) => (
                  <button key={t} className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-slate-50" onClick={() => { setTag(t); close(); }}>
                    <Chip t={t} /><span className="text-xs text-slate-500">{n}</span>
                  </button>
                ))}
                {!todasEtiquetas.length && <p className="px-2 py-1.5 text-slate-500">Aún no hay etiquetas</p>}
              </div>
            )}
          </Menu>
          <Menu label={`Filtro${filtrosActivos ? ` (${filtrosActivos})` : ""}`} icon={<Filter className="size-4" aria-hidden />} align="right" active={filtrosActivos > 0}>
            {() => (
              <div className="w-64 space-y-2 p-1">
                {vista === "bandeja" && opt("estado", "Estado", ESTADOS.filter((e) => e !== "Perdido"))}
                {opt("calidad", "Calidad", CALIDADES, "Sin calificar")}
                {opt("prioridad", "Prioridad", PRIORIDADES, "Sin prioridad")}
                {opt("canal", "Canal", CANALES)}
                {responsables.length > 1 && opt("resp", "Propietario", responsables)}
                {mostrarGrupo && opt("grupo", "Grupo", GRUPOS)}
                {filtrosActivos > 0 && <button className="btn-ghost w-full justify-center" onClick={() => setF({ estado: "", calidad: "", prioridad: "", canal: "", resp: "", grupo: "" })}>Quitar filtros</button>}
              </div>
            )}
          </Menu>
          <Menu label="" icon={<Settings2 className="size-4" aria-label="Columnas" />} align="right">
            {() => (
              <div className="w-56">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Columnas visibles</p>
                {COLS.filter((c) => !c.fija && (c.key !== "grupo" || mostrarGrupo)).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                    <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}
                  </label>
                ))}
              </div>
            )}
          </Menu>
        </div>
      </div>

      {/* Acciones con la selección */}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-natu-dark px-3 py-2 text-sm text-white">
          <span className="font-semibold">{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>
          <span className="mx-1 h-4 w-px bg-white/30" />
          {asignables.length > 0 && (
            <select disabled={pending} defaultValue="" onChange={(e) => { if (e.target.value) masiva("propietario", e.target.value === "-" ? "" : e.target.value); e.target.value = ""; }} className="rounded bg-white/10 px-2 py-1 text-white [&>option]:text-slate-900">
              <option value="" disabled>Asignar a…</option>
              <option value="-">Sin asignar</option>
              {asignables.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          )}
          <select disabled={pending} defaultValue="" onChange={(e) => { if (e.target.value) masiva("calidad", e.target.value); e.target.value = ""; }} className="rounded bg-white/10 px-2 py-1 text-white [&>option]:text-slate-900">
            <option value="" disabled>Calidad…</option>
            {CALIDADES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {vista === "bandeja" && (
            <select disabled={pending} defaultValue="" onChange={(e) => { if (e.target.value) masiva("estado", e.target.value); e.target.value = ""; }} className="rounded bg-white/10 px-2 py-1 text-white [&>option]:text-slate-900">
              <option value="" disabled>Estado…</option>
              {ESTADOS.filter((e) => e !== "Ganado" && e !== "Perdido").map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <button disabled={pending} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => { const t = prompt("Etiqueta a añadir (puedes poner varias separadas por comas):"); if (t?.trim()) masiva("etiqueta", t); }}>
            + Etiqueta
          </button>
          {vista === "bandeja"
            ? <button disabled={pending} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => confirm(`¿Archivar ${sel.size} prospecto(s)? Pasarán a «Perdido».`) && masiva("archivar")}><Archive className="mr-1 inline size-3.5" />Archivar</button>
            : <button disabled={pending} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => masiva("restaurar")}>Recuperar</button>}
          <button className="ml-auto rounded p-1 hover:bg-white/10" onClick={() => setSel(new Set())} aria-label="Quitar selección"><X className="size-4" /></button>
        </div>
      )}
      {aviso && <div className="mb-3 flex items-center gap-1.5 rounded-md bg-[#eef0e6] px-3 py-2 text-sm text-[#56613f] ring-1 ring-natu-sage"><Check className="size-4" />{aviso}</div>}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-700">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" aria-label="Seleccionar todos" checked={todosSel} onChange={() => setSel(todosSel ? new Set() : new Set(lista.slice(0, limite).map((c) => c.id)))} />
              </th>
              {visibles.map((c) => (
                <th key={c.key} className={clsx("whitespace-nowrap border-l border-slate-200 px-3 py-2.5", c.w)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (-sort.dir as 1 | -1) : c.key === "creado" || c.key === "ultima" ? -1 : 1 })}>
                      {c.label}
                      {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
              <th className="sticky right-0 w-10 bg-slate-50" />
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, limite).map((c) => (
              <tr key={c.id} className={clsx("border-b border-slate-100", sel.has(c.id) ? "bg-brand-50" : "bg-white hover:bg-slate-50")}>
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`Seleccionar ${c.nombre}`} checked={sel.has(c.id)}
                    onChange={() => { const s = new Set(sel); if (s.has(c.id)) s.delete(c.id); else s.add(c.id); setSel(s); }} />
                </td>
                {visibles.map((col) => <td key={col.key} className="whitespace-nowrap border-l border-slate-100 px-3 py-2 text-slate-800">{celda(c, col.key)}</td>)}
                <td className="sticky right-0 bg-inherit px-2 py-2">
                  <Menu label="" compact icon={<MoreHorizontal className="size-4" aria-label="Más acciones" />} align="right">
                    {(close) => (
                      <div className="w-48">
                        <Link href={`/clientes/${c.id}`} className="block rounded px-2 py-1.5 hover:bg-slate-50">Abrir ficha</Link>
                        <Link href={`/clientes/${c.id}/editar`} className="block rounded px-2 py-1.5 hover:bg-slate-50">Editar</Link>
                        {c.estado === "Perdido"
                          ? <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50" onClick={() => { close(); masiva("restaurar", "", [c.id]); }}>Recuperar</button>
                          : c.estado !== "Ganado" && <button className="block w-full rounded px-2 py-1.5 text-left text-rose-700 hover:bg-rose-50" onClick={() => { close(); masiva("archivar", "", [c.id]); }}>Archivar</button>}
                      </div>
                    )}
                  </Menu>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={visibles.length + 2} className="px-4 py-12 text-center text-slate-500">
                {vista === "archivo" ? "No hay prospectos archivados." : "No hay prospectos con estos filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {lista.length > limite && (
        <div className="mt-3 text-center">
          <button className="btn-ghost" onClick={() => setLimite(limite + PAGINA)}>Mostrar {Math.min(PAGINA, lista.length - limite)} más ({(lista.length - limite).toLocaleString("es-ES")} restantes)</button>
        </div>
      )}
    </div>
  );
}
