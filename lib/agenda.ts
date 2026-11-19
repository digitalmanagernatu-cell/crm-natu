import "server-only";
/**
 * Agenda de acciones comerciales programadas. La usan la interfaz y Alexia.
 * La «próxima acción» que se ve en la ficha y en las tablas es siempre la acción pendiente más
 * próxima de la agenda (sincronizarProxima), para que no haya dos fuentes de verdad.
 */
import { asignables, puedeEditar, verTarea } from "./permissions";
import { store } from "./store";
import type { Cliente, Tarea, TipoAccion, Usuario } from "./types";

export class AgendaError extends Error {}

const nid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const ahora = () => new Date().toISOString();
const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

async function log(clienteId: string, autor: string, tipo: TipoAccion, comentario: string, via?: string) {
  await store.insert("acciones", { id: nid("A"), clienteId, fecha: ahora(), tipo, autor, comentario: via ? `${comentario} (${via})` : comentario });
}

/** Recalcula la próxima acción del cliente a partir de su agenda. */
export async function sincronizarProxima(clienteId: string) {
  const d = await store.readAll();
  const c = d.clientes.find((x) => x.id === clienteId);
  if (!c) return;
  const prox = d.agenda
    .filter((t) => t.clienteId === clienteId && t.estado === "Pendiente")
    .sort((a, b) => `${a.fecha}${a.hora || "99"}`.localeCompare(`${b.fecha}${b.hora || "99"}`))[0];
  const proximaAccion = prox ? prox.titulo : "";
  const fechaProximaAccion = prox ? prox.fecha : "";
  if (c.proximaAccion !== proximaAccion || c.fechaProximaAccion !== fechaProximaAccion) {
    await store.update("clientes", { ...c, proximaAccion, fechaProximaAccion, actualizado: ahora() });
  }
}

export async function crearTarea(
  u: Usuario,
  t: { clienteId: string; tipo: Tarea["tipo"]; titulo: string; fecha: string; hora?: string; responsable?: string; notas?: string },
  via?: string,
) {
  const d = await store.readAll();
  const c = d.clientes.find((x) => x.id === t.clienteId);
  if (!c || !puedeEditar(u, c)) throw new AgendaError("No existe ese cliente o no tienes permiso sobre él.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha)) throw new AgendaError("Fecha no válida.");
  let responsable = u.email;
  if (u.rol !== "comercial") {
    const ok = (e: string) => e === u.email || asignables(u, d.usuarios).some((x) => x.email === e);
    if (t.responsable) {
      if (!ok(t.responsable)) throw new AgendaError("No puedes asignar la acción a esa persona.");
      responsable = t.responsable;
    } else if (c.responsable && ok(c.responsable)) {
      responsable = c.responsable; // por defecto, el propietario del cliente (si está activo)
    }
  }
  const tarea: Tarea = {
    id: nid("T"), clienteId: c.id, tipo: t.tipo, titulo: t.titulo.trim() || t.tipo, fecha: t.fecha, hora: t.hora ?? "",
    responsable, estado: "Pendiente", notas: t.notas ?? "", creadoPor: u.email, creado: ahora(), completada: "", resultado: "",
  };
  await store.insert("agenda", tarea);
  const quien = d.usuarios.find((x) => x.email === responsable)?.nombre ?? responsable;
  await log(c.id, u.email, "Sistema", `Programado: ${tarea.tipo} «${tarea.titulo}» para el ${fechaCorta(tarea.fecha)}${tarea.hora ? ` a las ${tarea.hora}` : ""} (${quien}).`, via);
  await sincronizarProxima(c.id);
  return { tarea, cliente: c };
}

async function tareaEditable(u: Usuario, id: string): Promise<{ t: Tarea; c: Cliente }> {
  const d = await store.readAll();
  const t = d.agenda.find((x) => x.id === id);
  const c = t && d.clientes.find((x) => x.id === t.clienteId);
  if (!t || !c || !puedeEditar(u, c) || !verTarea(u, t)) throw new AgendaError("No existe esa acción o no tienes permiso sobre ella.");
  return { t, c };
}

/** Marca la acción como hecha y la apunta en la bitácora del cliente con su resultado. */
export async function completarTarea(u: Usuario, id: string, resultado = "", via?: string) {
  const { t, c } = await tareaEditable(u, id);
  if (t.estado !== "Pendiente") throw new AgendaError("Esa acción ya no está pendiente.");
  await store.update("agenda", { ...t, estado: "Hecha", completada: ahora(), resultado: resultado.trim() });
  await log(c.id, u.email, t.tipo, `${t.titulo}${resultado.trim() ? `: ${resultado.trim()}` : ""}`, via);
  if (c.estado === "Nuevo") await store.update("clientes", { ...c, estado: "Contactado", actualizado: ahora() });
  await sincronizarProxima(c.id);
  return { tarea: t, cliente: c };
}

export async function reprogramarTarea(u: Usuario, id: string, fecha: string, hora?: string, via?: string) {
  const { t, c } = await tareaEditable(u, id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new AgendaError("Fecha no válida.");
  if (t.estado !== "Pendiente") throw new AgendaError("Esa acción ya no está pendiente.");
  await store.update("agenda", { ...t, fecha, hora: hora ?? t.hora });
  await log(c.id, u.email, "Sistema", `Reprogramado «${t.titulo}»: ${fechaCorta(t.fecha)} → ${fechaCorta(fecha)}${hora ? ` a las ${hora}` : ""}.`, via);
  await sincronizarProxima(c.id);
  return { tarea: t, cliente: c };
}

export async function cancelarTarea(u: Usuario, id: string, motivo = "", via?: string) {
  const { t, c } = await tareaEditable(u, id);
  if (t.estado !== "Pendiente") throw new AgendaError("Esa acción ya no está pendiente.");
  await store.update("agenda", { ...t, estado: "Cancelada", completada: ahora(), resultado: motivo });
  await log(c.id, u.email, "Sistema", `Cancelado «${t.titulo}» (${fechaCorta(t.fecha)})${motivo ? `: ${motivo}` : ""}.`, via);
  await sincronizarProxima(c.id);
  return { tarea: t, cliente: c };
}
