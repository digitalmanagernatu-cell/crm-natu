import "server-only";
/**
 * Operaciones de escritura sobre prospectos que usa Alexia. Aplican las mismas reglas de
 * permisos que la interfaz (lib/permissions) y dejan rastro en la bitácora («vía Alexia»).
 * Con DATA_SOURCE=excel todo se escribe directamente en el Excel.
 */
import { asignables, puedeEditar, puedeReasignar } from "./permissions";
import { store } from "./store";
import { joinTags, parseTags } from "./tags";
import type { Calidad, Canal, Cliente, Estado, Grupo, Prioridad, Proyecto, Usuario } from "./types";

const nid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const ahora = () => new Date().toISOString();
const hoy = () => ahora().slice(0, 10);
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export class MutacionError extends Error {}

async function log(clienteId: string, autor: string, comentario: string) {
  await store.insert("acciones", { id: nid("A"), clienteId, fecha: ahora(), tipo: "Sistema", autor, comentario: `${comentario} (vía Alexia)` });
}

async function editable(u: Usuario, id: string) {
  const d = await store.readAll();
  const c = d.clientes.find((x) => x.id === id);
  if (!c || !puedeEditar(u, c)) throw new MutacionError("No existe ese prospecto o no tienes permiso sobre él.");
  return { c, d };
}

/** Busca un usuario asignable por nombre o email. Devuelve "" para «sin asignar». */
export function resolverResponsable(u: Usuario, usuarios: Usuario[], texto: string): string {
  const t = norm(texto);
  if (!t || ["sin asignar", "nadie", "ninguno"].includes(t)) return "";
  const lista = asignables(u, usuarios);
  const exactos = lista.filter((x) => x.email === t || norm(x.nombre) === t);
  const posibles = exactos.length ? exactos : lista.filter((x) => norm(`${x.nombre} ${x.email}`).includes(t));
  if (posibles.length === 1) return posibles[0]!.email;
  if (!posibles.length) throw new MutacionError(`No puedes asignar a «${texto}» (no existe o no está en tu grupo). Opciones: ${lista.map((x) => x.nombre).join(", ")}.`);
  throw new MutacionError(`Hay varias personas que encajan con «${texto}»: ${posibles.map((x) => x.nombre).join(", ")}.`);
}

export type DatosProspecto = Partial<{
  nombre: string; grupo: Grupo; zona: string; contacto: string; cargo: string; email: string; telefono: string;
  canal: Canal | ""; origen: string; calidad: Calidad | ""; prioridad: Prioridad | ""; estado: Estado;
  proximaAccion: string; fechaProximaAccion: string; notas: string; agenteInicial: string;
}>;

export async function crearProspecto(u: Usuario, datos: DatosProspecto & { nombre: string; etiquetas?: string[]; responsable?: string }) {
  const d = await store.readAll();
  let responsable = u.email;
  if (datos.responsable !== undefined && u.rol !== "comercial") responsable = resolverResponsable(u, d.usuarios, datos.responsable);
  const grupo: Grupo = u.grupo !== "Todos" ? u.grupo : datos.grupo ?? "Export";
  const estado = datos.estado && datos.estado !== "Ganado" && datos.estado !== "Perdido" ? datos.estado : "Nuevo";
  const c: Cliente = {
    id: nid("C"), nombre: datos.nombre.trim(), grupo, responsable, agenteInicial: datos.agenteInicial ?? "",
    zona: datos.zona ?? "", contacto: datos.contacto ?? "", cargo: datos.cargo ?? "", email: datos.email ?? "", telefono: datos.telefono ?? "",
    canal: datos.canal ?? "", origen: datos.origen ?? "", calidad: datos.calidad ?? "", prioridad: datos.prioridad ?? "",
    etiquetas: joinTags(datos.etiquetas ?? []), estado, fechaAlta: ahora(), fechaGanado: "",
    proximaAccion: datos.proximaAccion ?? "", fechaProximaAccion: datos.fechaProximaAccion ?? "", notas: datos.notas ?? "", actualizado: ahora(),
  };
  await store.insert("clientes", c);
  await log(c.id, u.email, `Prospecto creado (${c.canal || "canal sin definir"}${c.origen ? ` · ${c.origen}` : ""}).`);
  return c;
}

/** Prospectos con nombre parecido (para avisar de duplicados). */
export async function parecidos(u: Usuario, nombre: string) {
  const d = await store.readAll();
  const n = norm(nombre);
  return d.clientes.filter((c) => puedeEditar(u, c) && (norm(c.nombre).includes(n) || n.includes(norm(c.nombre)))).slice(0, 5);
}

export async function actualizarProspecto(u: Usuario, id: string, cambios: DatosProspecto & { etiquetasAnadir?: string[]; etiquetasQuitar?: string[]; responsable?: string; notaAnadir?: string }) {
  const { c, d } = await editable(u, id);
  const nuevo: Cliente = { ...c, actualizado: ahora() };
  const hechos: [string, string][] = [];
  const campos: (keyof DatosProspecto)[] = ["nombre", "zona", "contacto", "cargo", "email", "telefono", "canal", "origen", "calidad", "prioridad", "proximaAccion", "fechaProximaAccion", "agenteInicial"];
  const etiqueta: Partial<Record<keyof DatosProspecto, string>> = { nombre: "Nombre", zona: "Zona / País", contacto: "Contacto", cargo: "Cargo", email: "Email", telefono: "Teléfono", canal: "Canal", origen: "Origen", calidad: "Calidad", prioridad: "Prioridad", proximaAccion: "Próxima acción", fechaProximaAccion: "Fecha próxima acción", agenteInicial: "Agente inicial" };
  for (const k of campos) {
    const v = cambios[k];
    if (v === undefined || v === (c as unknown as Record<string, unknown>)[k]) continue;
    (nuevo as unknown as Record<string, unknown>)[k] = v;
    hechos.push([etiqueta[k] ?? k, `${(c as unknown as Record<string, string>)[k] || "—"} → ${v || "—"}`]);
  }
  if (cambios.estado && cambios.estado !== c.estado) {
    if (cambios.estado === "Ganado" || cambios.estado === "Perdido") throw new MutacionError("Para pasar a Ganado o archivar usa la acción específica (requiere confirmación).");
    if (c.estado === "Ganado") throw new MutacionError("Es un cliente ganado; su estado no se cambia desde aquí.");
    nuevo.estado = cambios.estado;
    hechos.push(["Estado", `${c.estado} → ${cambios.estado}`]);
  }
  if (cambios.etiquetasAnadir?.length || cambios.etiquetasQuitar?.length) {
    const quitar = new Set((cambios.etiquetasQuitar ?? []).map(norm));
    const tags = joinTags([...parseTags(c.etiquetas).filter((t) => !quitar.has(norm(t))), ...(cambios.etiquetasAnadir ?? [])]);
    if (tags !== c.etiquetas) { nuevo.etiquetas = tags; hechos.push(["Etiquetas", tags || "—"]); }
  }
  if (cambios.responsable !== undefined) {
    if (!puedeReasignar(u, c)) throw new MutacionError("Solo un responsable de grupo o un administrador puede reasignar.");
    const r = resolverResponsable(u, d.usuarios, cambios.responsable);
    if (r !== c.responsable) { nuevo.responsable = r; hechos.push(["Propietario", `${d.usuarios.find((x) => x.email === c.responsable)?.nombre ?? (c.responsable || "—")} → ${d.usuarios.find((x) => x.email === r)?.nombre ?? "Sin asignar"}`]); }
  }
  if (cambios.notaAnadir?.trim()) {
    nuevo.notas = [c.notas, cambios.notaAnadir.trim()].filter(Boolean).join("\n");
    hechos.push(["Notas", `+ ${cambios.notaAnadir.trim()}`]);
  }
  if (!hechos.length) return { cliente: c, hechos };
  await store.update("clientes", nuevo);
  await log(id, u.email, `Ficha actualizada: ${hechos.map(([k, v]) => `${k}: ${v}`).join("; ")}.`);
  return { cliente: nuevo, hechos };
}

export async function archivarProspecto(u: Usuario, id: string, motivo: string) {
  const { c } = await editable(u, id);
  if (c.estado === "Ganado") throw new MutacionError("Es un cliente ganado; no se archiva.");
  if (c.estado === "Perdido") return c;
  const nuevo = { ...c, estado: "Perdido" as const, actualizado: ahora() };
  await store.update("clientes", nuevo);
  await log(id, u.email, `Archivado (${c.estado} → Perdido)${motivo ? `. Motivo: ${motivo}` : ""}.`);
  return nuevo;
}

export async function pasarAGanado(u: Usuario, id: string, p: { nombre?: string; importe?: number | null; fecha?: string; notas?: string }) {
  const { c } = await editable(u, id);
  if (c.estado === "Ganado") throw new MutacionError("Ya es un cliente ganado; para un proyecto nuevo usa registrar_proyecto.");
  const fecha = p.fecha || hoy();
  await store.update("clientes", { ...c, estado: "Ganado", fechaGanado: fecha, actualizado: ahora() });
  const proyecto: Proyecto = { id: nid("P"), clienteId: id, nombre: p.nombre?.trim() || "Primer proyecto", importe: p.importe ?? null, fecha, estado: "En curso", autor: u.email, notas: p.notas ?? "" };
  await store.insert("proyectos", proyecto);
  await log(id, u.email, `🎉 Prospecto pasado a GANADO. Primer proyecto: "${proyecto.nombre}"${proyecto.importe !== null ? ` · ${proyecto.importe.toLocaleString("es-ES")} €` : ""}.`);
  return { cliente: c, proyecto };
}

export async function registrarProyecto(u: Usuario, id: string, p: { nombre: string; importe?: number | null; fecha?: string; notas?: string }) {
  const { c } = await editable(u, id);
  const proyecto: Proyecto = { id: nid("P"), clienteId: id, nombre: p.nombre.trim(), importe: p.importe ?? null, fecha: p.fecha || hoy(), estado: "En curso", autor: u.email, notas: p.notas ?? "" };
  await store.insert("proyectos", proyecto);
  await log(id, u.email, `Nuevo proyecto: "${proyecto.nombre}"${proyecto.importe !== null ? ` · ${proyecto.importe.toLocaleString("es-ES")} €` : ""}.`);
  return { cliente: c, proyecto };
}
