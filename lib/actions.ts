"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asignables, esAdmin, puedeEditar, puedeReasignar } from "./permissions";
import { AgendaError, cancelarTarea, completarTarea, crearTarea, reprogramarTarea } from "./agenda";
import { requireUsuario } from "./session";
import { store } from "./store";
import { joinTags, parseTags } from "./tags";
import {
  CALIDADES, CANALES, ESTADOS, ESTADOS_PROYECTO, GRUPOS, PRIORIDADES, ROLES, TIPOS_ACCION,
  type Accion, type Cliente, type Proyecto, type Usuario,
} from "./types";

const nid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const ahora = () => new Date().toISOString();
const hoy = () => ahora().slice(0, 10);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = <T extends readonly string[]>(vals: T) => z.union([z.enum(vals), z.literal("")]);

async function clienteEditable(id: string) {
  const u = await requireUsuario();
  const d = await store.readAll();
  const c = d.clientes.find((x) => x.id === id);
  if (!c || !puedeEditar(u, c)) throw new Error("No tienes permiso sobre este cliente");
  return { u, c, d };
}

async function log(clienteId: string, autor: string, tipo: Accion["tipo"], comentario: string) {
  await store.insert("acciones", { id: nid("A"), clienteId, fecha: ahora(), tipo, autor, comentario });
}

const ClienteForm = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  grupo: z.enum(GRUPOS),
  responsable: z.string(),
  zona: z.string(), contacto: z.string(), cargo: z.string(), email: z.string(), telefono: z.string(),
  agenteInicial: z.string(),
  canal: opt(CANALES), calidad: opt(CALIDADES), estado: z.enum(ESTADOS),
  origen: z.string(), prioridad: opt(PRIORIDADES), etiquetas: z.string(),
  proximaAccion: z.string(), fechaProximaAccion: z.string(), notas: z.string(),
});

function leerForm(f: FormData) {
  const v = ClienteForm.parse(Object.fromEntries(Object.keys(ClienteForm.shape).map((k) => [k, str(f, k)])));
  return { ...v, etiquetas: joinTags(parseTags(v.etiquetas)) };
}

/** Aplica las reglas de rol sobre grupo y responsable. */
function sanearAsignacion(u: Usuario, usuarios: Usuario[], v: { grupo: Cliente["grupo"]; responsable: string }, actual?: string) {
  if (u.rol === "comercial") return { grupo: u.grupo === "Todos" ? v.grupo : u.grupo, responsable: u.email };
  if (u.rol === "responsable" && u.grupo !== "Todos") v.grupo = u.grupo;
  // Se permite dejar el propietario que ya tenía (aunque ahora esté inactivo, p. ej. una antigua comercial).
  if (v.responsable && v.responsable !== actual && !asignables(u, usuarios).some((x) => x.email === v.responsable)) v.responsable = "";
  return v;
}

export async function crearCliente(f: FormData) {
  const u = await requireUsuario();
  const d = await store.readAll();
  const v = leerForm(f);
  const asign = sanearAsignacion(u, d.usuarios, { grupo: v.grupo, responsable: v.responsable });
  const c: Cliente = { ...v, ...asign, id: nid("C"), fechaAlta: ahora(), fechaGanado: v.estado === "Ganado" ? hoy() : "", actualizado: ahora(), proximaAccion: "", fechaProximaAccion: "" };
  await store.insert("clientes", c);
  await log(c.id, u.email, "Sistema", `Prospecto creado (${c.canal || "canal sin definir"}).`);
  if (v.fechaProximaAccion) await crearTarea(u, { clienteId: c.id, tipo: "Llamada", titulo: v.proximaAccion || "Primer contacto", fecha: v.fechaProximaAccion });
  revalidatePath("/", "layout");
  redirect(`/clientes/${c.id}`);
}

export async function actualizarCliente(id: string, f: FormData) {
  const { u, c, d } = await clienteEditable(id);
  const v = leerForm(f);
  const asign = puedeReasignar(u, c)
    ? sanearAsignacion(u, d.usuarios, { grupo: v.grupo, responsable: v.responsable }, c.responsable)
    : { grupo: c.grupo, responsable: c.responsable };
  // La próxima acción la gestiona la Agenda: no se toca desde la ficha.
  const nuevo: Cliente = { ...c, ...v, ...asign, proximaAccion: c.proximaAccion, fechaProximaAccion: c.fechaProximaAccion, actualizado: ahora() };
  if (v.estado === "Ganado" && !c.fechaGanado) nuevo.fechaGanado = hoy();
  await store.update("clientes", nuevo);
  const cambios: string[] = [];
  if (c.estado !== nuevo.estado) cambios.push(`estado: ${c.estado} → ${nuevo.estado}`);
  if (c.calidad !== nuevo.calidad) cambios.push(`calidad: ${c.calidad || "—"} → ${nuevo.calidad || "—"}`);
  if (c.responsable !== nuevo.responsable) cambios.push(`responsable: ${c.responsable || "—"} → ${nuevo.responsable || "—"}`);
  if (cambios.length) await log(id, u.email, "Sistema", `Cambios en la ficha (${cambios.join("; ")}).`);
  revalidatePath("/", "layout");
  redirect(`/clientes/${id}`);
}

export async function anadirAccion(clienteId: string, f: FormData) {
  const { u, c } = await clienteEditable(clienteId);
  const tipo = z.enum(TIPOS_ACCION).parse(str(f, "tipo"));
  const comentario = z.string().min(1, "Escribe un comentario").parse(str(f, "comentario"));
  const fecha = str(f, "fecha");
  await store.insert("acciones", {
    id: nid("A"), clienteId, tipo, comentario, autor: u.email,
    fecha: fecha && fecha !== hoy() ? new Date(`${fecha}T12:00:00`).toISOString() : ahora(),
  });
  // Si el prospecto estaba en "Nuevo", la primera acción lo pasa a "Contactado".
  const estado = c.estado === "Nuevo" ? "Contactado" : c.estado;
  await store.update("clientes", { ...c, estado, actualizado: ahora() });
  const fprox = str(f, "fechaProximaAccion");
  if (fprox) {
    await crearTarea(u, {
      clienteId, tipo: z.enum(TIPOS_ACCION).catch("Llamada").parse(str(f, "tipoProxima") || "Llamada"),
      titulo: str(f, "proximaAccion") || "Seguimiento", fecha: fprox, hora: str(f, "horaProxima"),
    });
  }
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/", "layout");
}

export async function cambiarEstado(clienteId: string, estado: string) {
  const { u, c } = await clienteEditable(clienteId);
  const e = z.enum(ESTADOS).parse(estado);
  if (e === "Ganado") throw new Error("Usa 'Pasar a Ganado' para registrar el primer proyecto");
  await store.update("clientes", { ...c, estado: e, actualizado: ahora() });
  await log(clienteId, u.email, "Sistema", `Estado: ${c.estado} → ${e}.`);
  revalidatePath("/", "layout");
}

function leerImporte(f: FormData) {
  const raw = str(f, "importe").replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("Importe no válido");
  return n;
}

export async function marcarGanado(clienteId: string, f: FormData) {
  const { u, c } = await clienteEditable(clienteId);
  const importe = leerImporte(f);
  const nombre = str(f, "nombre") || "Primer proyecto";
  const fecha = str(f, "fecha") || hoy();
  await store.update("clientes", { ...c, estado: "Ganado", fechaGanado: fecha, calidad: c.calidad, actualizado: ahora() });
  const p: Proyecto = { id: nid("P"), clienteId, nombre, importe, fecha, estado: "En curso", autor: u.email, notas: str(f, "notas") };
  await store.insert("proyectos", p);
  await log(clienteId, u.email, "Sistema",
    `🎉 Prospecto pasado a GANADO. Primer proyecto: "${nombre}"${importe !== null ? ` · ${importe.toLocaleString("es-ES")} €` : ""}.`);
  revalidatePath("/", "layout");
}

export async function anadirProyecto(clienteId: string, f: FormData) {
  const { u } = await clienteEditable(clienteId);
  const nombre = z.string().min(1, "Pon un nombre al proyecto").parse(str(f, "nombre"));
  const p: Proyecto = {
    id: nid("P"), clienteId, nombre, importe: leerImporte(f), fecha: str(f, "fecha") || hoy(),
    estado: z.enum(ESTADOS_PROYECTO).parse(str(f, "estado") || "En curso"), autor: u.email, notas: str(f, "notas"),
  };
  await store.insert("proyectos", p);
  await log(clienteId, u.email, "Sistema", `Nuevo proyecto: "${nombre}"${p.importe !== null ? ` · ${p.importe.toLocaleString("es-ES")} €` : ""}.`);
  revalidatePath("/", "layout");
}

export async function actualizarEstadoProyecto(proyectoId: string, estado: string) {
  const u = await requireUsuario();
  const d = await store.readAll();
  const p = d.proyectos.find((x) => x.id === proyectoId);
  const c = p && d.clientes.find((x) => x.id === p.clienteId);
  if (!p || !c || !puedeEditar(u, c)) throw new Error("Sin permiso");
  await store.update("proyectos", { ...p, estado: z.enum(ESTADOS_PROYECTO).parse(estado) });
  revalidatePath("/", "layout");
}

export async function guardarUsuario(f: FormData) {
  const u = await requireUsuario();
  if (!esAdmin(u)) throw new Error("Solo administradores");
  const d = await store.readAll();
  const nuevo: Usuario = {
    email: z.string().email("Email no válido").parse(str(f, "email").toLowerCase()),
    nombre: str(f, "nombre"),
    grupo: z.enum([...GRUPOS, "Todos"]).parse(str(f, "grupo")),
    rol: z.enum(ROLES).parse(str(f, "rol")),
    activo: f.get("activo") === "on",
  };
  if (d.usuarios.some((x) => x.email === nuevo.email)) await store.update("usuarios", nuevo);
  else await store.insert("usuarios", nuevo);
  revalidatePath("/usuarios");
}

/** Acciones sobre varios prospectos a la vez (tabla de prospectos). Comprueba permisos fila a fila. */
export async function accionMasiva(ids: string[], op: "propietario" | "etiqueta" | "quitarEtiqueta" | "estado" | "calidad" | "prioridad" | "archivar" | "restaurar", valor = "") {
  const u = await requireUsuario();
  const d = await store.readAll();
  if (op === "propietario" && valor && !asignables(u, d.usuarios).some((x) => x.email === valor)) throw new Error("No puedes asignar a esa persona");
  if (op === "estado" && (valor === "Ganado" || !ESTADOS.includes(valor as never))) throw new Error("Estado no válido");
  if (op === "calidad" && valor && !CALIDADES.includes(valor as never)) throw new Error("Calidad no válida");
  if (op === "prioridad" && valor && !PRIORIDADES.includes(valor as never)) throw new Error("Prioridad no válida");
  let n = 0;
  for (const id of ids.slice(0, 500)) {
    const c = d.clientes.find((x) => x.id === id);
    if (!c || !puedeEditar(u, c)) continue;
    if (op === "propietario" && !puedeReasignar(u, c)) continue;
    const nuevo: Cliente = { ...c, actualizado: ahora() };
    let nota = "";
    switch (op) {
      case "propietario": nuevo.responsable = valor; nota = `Responsable: ${c.responsable || "—"} → ${valor || "—"}.`; break;
      case "etiqueta": nuevo.etiquetas = joinTags([...parseTags(c.etiquetas), ...parseTags(valor)]); break;
      case "quitarEtiqueta": nuevo.etiquetas = joinTags(parseTags(c.etiquetas).filter((t) => t.toLowerCase() !== valor.trim().toLowerCase())); break;
      case "estado": nuevo.estado = valor as Cliente["estado"]; nota = `Estado: ${c.estado} → ${valor}.`; break;
      case "calidad": nuevo.calidad = valor as Cliente["calidad"]; nota = `Calidad: ${c.calidad || "—"} → ${valor || "—"}.`; break;
      case "prioridad": nuevo.prioridad = valor as Cliente["prioridad"]; break;
      case "archivar": if (c.estado === "Ganado") continue; nuevo.estado = "Perdido"; nota = `Archivado (${c.estado} → Perdido).`; break;
      case "restaurar": if (c.estado !== "Perdido") continue; nuevo.estado = "Contactado"; nota = "Recuperado del archivo (Perdido → Contactado)."; break;
    }
    await store.update("clientes", nuevo);
    if (nota) await log(id, u.email, "Sistema", nota);
    n++;
  }
  revalidatePath("/", "layout");
  return n;
}

// ── Agenda ──────────────────────────────────────────────────────────────
const errMsg = (e: unknown) => { if (e instanceof AgendaError) throw new Error(e.message); throw e; };

export async function nuevaTarea(f: FormData) {
  const u = await requireUsuario();
  await crearTarea(u, {
    clienteId: str(f, "clienteId"), tipo: z.enum(TIPOS_ACCION).parse(str(f, "tipo")), titulo: str(f, "titulo"),
    fecha: str(f, "fecha"), hora: str(f, "hora"), responsable: str(f, "responsable") || undefined, notas: str(f, "notas"),
  }).catch(errMsg);
  revalidatePath("/", "layout");
}

export async function marcarHecha(id: string, resultado: string) {
  const u = await requireUsuario();
  await completarTarea(u, id, resultado).catch(errMsg);
  revalidatePath("/", "layout");
}

export async function reprogramar(id: string, fecha: string, hora: string) {
  const u = await requireUsuario();
  await reprogramarTarea(u, id, fecha, hora).catch(errMsg);
  revalidatePath("/", "layout");
}

export async function cancelar(id: string, motivo: string) {
  const u = await requireUsuario();
  await cancelarTarea(u, id, motivo).catch(errMsg);
  revalidatePath("/", "layout");
}
