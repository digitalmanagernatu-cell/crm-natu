import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { diasDesde, nombreDe } from "./format";
import { filtrarDatos, puedeEditar } from "./permissions";
import { calcularStats, ultimaAccion } from "./stats";
import { store } from "./store";
import { actualizarProspecto, crearProspecto, MutacionError, parecidos, registrarProyecto } from "./mutations";
import { firmar } from "./pending";
import { parseTags } from "./tags";
import { CALIDADES, CANALES, ESTADOS, GRUPOS, PRIORIDADES, ROL_LABEL, TIPOS_ACCION, type Usuario } from "./types";

/** Modelo del asistente (OpenAI), el mismo que en NPD. Se cambia con OPENAI_MODEL sin tocar código. */
export const MODEL = process.env.OPENAI_MODEL || "gpt-6.1-terra";
export const assistantEnabled = () => !!process.env.OPENAI_API_KEY;

let client: OpenAI | null = null;
const getClient = () => (client ??= new OpenAI());

/** Guía estable (va en el prefijo cacheado). Misma Alexia que en la plataforma NPD, ahora en el CRM. */
const GUIDE = `Eres Alexia, la asistente virtual de NATU Laboratories (Laboratorios NatuAromatic S.L.), fabricante español de perfumería, cosmética y ambientación. Aquí trabajas dentro del CRM comercial, con los equipos de Export y Gran Consumo: les ayudas a saber cómo va cada cliente y prospecto, qué tienen pendiente y a apuntar lo que hacen.

Personalidad:
- Eres Alexia: resolutiva, cercana y con chispa. Hablas como una compañera de equipo que se lo sabe todo de los clientes y te lo cuenta con buen humor, sin dejar de ser profesional.
- Tuteas, en español de España, con frases naturales («Te cuento», «Vamos al lío»). Nada de tono robótico ni de fórmulas de atención al cliente.
- Un toque de humor ligero de vez en cuando, como mucho una frase (celebrar un cliente ganado, animar con lo pendiente). Nunca a costa de personas ni clientes.
- Primero el dato, luego la chispa. Si la pregunta es seca o urgente, contesta directo. Sin humor con malas noticias (cliente perdido, acciones vencidas): ahí práctica, con el siguiente paso claro.
- Emojis: como mucho uno por respuesta y solo si suma (✅ 🎉 🌿 👀); en listas de datos, ninguno.

Cómo responder:
- Responde siempre en español, breve y claro. Usa listas cortas cuando ayuden.
- Para datos de clientes usa SIEMPRE las herramientas; nunca inventes nombres, fechas, importes, estados ni personas.
- La gente no escribe los nombres exactos: busca con lo que te digan (la búsqueda no distingue tildes) y, si no sale, prueba con una palabra clave antes de decir que no existe.
- Solo ves los clientes que esta persona tiene permiso para ver: las herramientas ya lo filtran. Si un cliente no aparece, di que no existe o que no tiene acceso.
- Cuando menciones un cliente, enlázalo así: [Nombre](/clientes/<id>).
- Para resumir un cliente o proponer próximos pasos, lee su bitácora completa con ver_cliente.
- anotar_en_bitacora apunta AL MOMENTO una acción en la bitácora de un cliente (y, si se indica, la próxima acción con su fecha). Antes de usarla asegúrate de que está claro el cliente y lo que hay que apuntar; si hay dudas (varios clientes posibles, texto poco claro), pregunta primero. Redacta la nota en primera persona de quien la pide, clara y sin inventar datos. Cuando la herramienta diga que está hecho, confírmalo en una frase: debajo de tu respuesta aparece una tarjeta con el detalle, no lo repitas.
- También puedes ACTUALIZAR el CRM (se guarda al momento en el Excel, con los permisos de la persona):
  · crear_prospecto: da de alta un prospecto. Antes, si el nombre se parece a uno existente, la herramienta te avisa: pregunta si es el mismo antes de forzar el alta.
  · actualizar_prospecto: cambia datos de la ficha (contacto, email, teléfono, zona, canal, origen, calidad, prioridad, estado hasta Negociación, etiquetas, próxima acción, notas) o reasigna el propietario (solo responsables y administradores).
  · registrar_proyecto: añade un proyecto (con importe opcional) a un cliente.
  · archivar_prospecto y pasar_a_ganado NO se hacen al momento: preparan la acción y la persona debe pulsar «Confirmar» en la tarjeta. Di en una frase qué has preparado y pide que lo confirme; no digas que está hecho.
  · Si la petición es ambigua (qué prospecto, qué valor, a quién asignar), pregunta antes de llamar a la herramienta. Usa los valores exactos de las listas (calidad, prioridad, canal, estado). Las fechas, en formato AAAA-MM-DD.
  · Tras un cambio hecho, confírmalo en una frase: la tarjeta con el detalle aparece debajo, no lo repitas.

Cómo funciona el CRM:
- Dos grupos: Export y Gran Consumo. Roles: Comercial (ve solo sus clientes), Responsable de grupo (ve todo su grupo y reasigna), Administrador (todo, y gestiona usuarios en «Usuarios»).
- Los datos viven en un Excel de SharePoint (hojas Clientes, Acciones, Proyectos y Usuarios); todo lo que se hace en el CRM se escribe allí.
- Estados del embudo: Nuevo, Contactado, Propuesta enviada, Negociación, Ganado, Perdido. La primera acción de la bitácora pasa un prospecto de Nuevo a Contactado.
- Calidad del prospecto: A · Caliente, B · Templado, C · Frío. Prioridad: Alta, Media, Baja. Canal de procedencia: Feria, Prospección, Email, Web, Ads, LinkedIn, Otro; «Origen» es el detalle (feria concreta, formulario…). Etiquetas libres de colores (p. ej. «FG», «Información enviada»).
- Pestaña «Prospectos»: tabla con bandeja (abiertos) y archivo (perdidos/descartados), buscador, filtro por etiqueta, «Filtro» (estado, calidad, prioridad, canal, propietario), columnas configurables y selección múltiple para asignar, cambiar calidad o estado, añadir etiquetas o archivar. Pestaña «Clientes»: los ganados, con sus proyectos e importe.
- Nuevo prospecto: botón «Nuevo prospecto» de la cabecera o «+ Prospecto» en la tabla.
- Ficha del cliente: datos, bitácora (añadir acción con tipo, fecha y comentario, y opcionalmente «Programar próxima acción»), selector de estado, botón «Pasar a Ganado» (cuando se firma el primer contrato: pide nombre del primer proyecto e importe opcional) y tarjeta «Proyectos» con «+ Nuevo proyecto» para clientes que ya trabajan con nosotros.
- Panel: indicadores, embudo por estado, canal de procedencia, tabla por comercial y «Necesitan atención»: prospectos abiertos con acción vencida o 14 días o más sin actividad.`;

function jsonSchema(schema: z.ZodType) {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

type AssistantTool = { def: OpenAI.Responses.FunctionTool; schema: z.ZodType; run: (input: never) => Promise<string> };
function defineTool<S extends z.ZodType>(t: { name: string; description: string; inputSchema: S; run: (input: z.infer<S>) => Promise<string> }): AssistantTool {
  return {
    def: { type: "function", name: t.name, description: t.description, parameters: jsonSchema(t.inputSchema), strict: false },
    schema: t.inputSchema,
    run: t.run as (input: never) => Promise<string>,
  };
}

/** Tarjeta que el widget pinta bajo la respuesta (mismo formato que en NPD). */
export type ActionCard = { id: string; title: string; lines: [string, string][]; status: "done" | "failed" | "pending"; result?: string; token?: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Herramientas: todas trabajan sobre los datos ya filtrados por los permisos del usuario. */
function toolsFor(u: Usuario, cards: ActionCard[]) {
  const datos = async () => filtrarDatos(u, await store.readAll());

  const buscar = defineTool({
    name: "buscar_clientes",
    description: "Busca y cuenta clientes y prospectos visibles para el usuario. Devuelve el total y como máximo 40.",
    inputSchema: z.object({
      texto: z.string().max(200).optional().describe("Nombre, país, contacto, email, origen, etiquetas o notas (no distingue tildes)"),
      etiqueta: z.string().max(100).optional(),
      prioridad: z.enum(PRIORIDADES).optional(),
      estado: z.enum(ESTADOS).optional(),
      calidad: z.enum(CALIDADES).optional(),
      canal: z.enum(CANALES).optional(),
      grupo: z.enum(GRUPOS).optional(),
      comercial: z.string().max(100).optional().describe("Nombre o email del comercial responsable"),
      sin_actividad_dias: z.number().int().min(1).optional().describe("Solo los que llevan al menos N días sin acciones"),
      solo_abiertos: z.boolean().optional().describe("Excluir Ganado y Perdido"),
    }),
    run: async (f) => {
      const d = await datos();
      const ult = ultimaAccion(d);
      const r = d.clientes
        .map((c) => ({ c, ultima: ult.get(c.id) ?? c.fechaAlta, resp: nombreDe(c.responsable, d.usuarios) }))
        .filter(({ c, ultima, resp }) =>
          (!f.texto || f.texto.split(/\s+/).every((w) => norm([c.nombre, c.zona, c.contacto, c.email, c.notas, c.origen, c.etiquetas].join(" ")).includes(norm(w)))) &&
          (!f.etiqueta || parseTags(c.etiquetas).some((t) => norm(t) === norm(f.etiqueta!))) && (!f.prioridad || c.prioridad === f.prioridad) &&
          (!f.estado || c.estado === f.estado) && (!f.calidad || c.calidad === f.calidad) && (!f.canal || c.canal === f.canal) &&
          (!f.grupo || c.grupo === f.grupo) &&
          (!f.comercial || norm(`${resp} ${c.responsable}`).includes(norm(f.comercial))) &&
          (!f.sin_actividad_dias || diasDesde(ultima) >= f.sin_actividad_dias) &&
          (!f.solo_abiertos || (c.estado !== "Ganado" && c.estado !== "Perdido")))
        .sort((a, b) => b.ultima.localeCompare(a.ultima));
      if (!r.length) return "No hay clientes visibles que cumplan esos criterios.";
      return JSON.stringify({
        total: r.length,
        clientes: r.slice(0, 40).map(({ c, ultima, resp }) => ({
          id: c.id, nombre: c.nombre, zona: c.zona, grupo: c.grupo, estado: c.estado, calidad: c.calidad || null,
          canal: c.canal || null, origen: c.origen || null, prioridad: c.prioridad || null, etiquetas: parseTags(c.etiquetas), comercial: resp, ultima_actividad: ultima.slice(0, 10), dias_sin_actividad: diasDesde(ultima),
          proxima_accion: c.proximaAccion || null, fecha_proxima_accion: c.fechaProximaAccion || null,
        })),
      });
    },
  });

  const ver = defineTool({
    name: "ver_cliente",
    description: "Ficha completa de un cliente: datos, bitácora completa (más reciente primero) y proyectos con importes.",
    inputSchema: z.object({ id: z.string().describe("ID del cliente (de buscar_clientes o de la página abierta)") }),
    run: async ({ id }) => {
      const d = await datos();
      const c = d.clientes.find((x) => x.id === id);
      if (!c) return "No existe o no tienes acceso a ese cliente.";
      return JSON.stringify({
        ...c,
        responsable: nombreDe(c.responsable, d.usuarios),
        bitacora: d.acciones.filter((a) => a.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha))
          .map((a) => ({ fecha: a.fecha.slice(0, 10), tipo: a.tipo, autor: nombreDe(a.autor, d.usuarios), comentario: a.comentario })),
        proyectos: d.proyectos.filter((p) => p.clienteId === id).map((p) => ({ nombre: p.nombre, importe_eur: p.importe, fecha: p.fecha, estado: p.estado })),
      });
    },
  });

  const resumen = defineTool({
    name: "resumen_pipeline",
    description: "Indicadores del pipeline visible: embudo por estado, canales, calidad, actividad por semana, importe por mes, por comercial y prospectos que necesitan atención.",
    inputSchema: z.object({ grupo: z.enum(GRUPOS).optional() }),
    run: async ({ grupo }) => {
      const d = await datos();
      if (grupo) {
        d.clientes = d.clientes.filter((c) => c.grupo === grupo);
        const ids = new Set(d.clientes.map((c) => c.id));
        d.acciones = d.acciones.filter((a) => ids.has(a.clienteId));
        d.proyectos = d.proyectos.filter((p) => ids.has(p.clienteId));
      }
      const s = calcularStats(d);
      return JSON.stringify({ ...s, atencion: s.atencion.slice(0, 20).map(({ c, dias, vencida }) => ({ id: c.id, nombre: c.nombre, dias_sin_actividad: dias, accion_vencida: vencida })) });
    },
  });

  const anotar = defineTool({
    name: "anotar_en_bitacora",
    description: "Apunta al momento una acción en la bitácora de un cliente en nombre del usuario y, opcionalmente, programa la próxima acción.",
    inputSchema: z.object({
      cliente_id: z.string(),
      tipo: z.enum(TIPOS_ACCION),
      comentario: z.string().min(1).max(4000),
      proxima_accion: z.string().max(300).optional(),
      fecha_proxima_accion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD"),
    }),
    run: async (i) => {
      const d = await store.readAll();
      const c = d.clientes.find((x) => x.id === i.cliente_id);
      if (!c || !puedeEditar(u, c)) return "No tienes permiso sobre ese cliente (o no existe).";
      const ahora = new Date().toISOString();
      await store.insert("acciones", { id: `A-${Date.now().toString(36)}`.toUpperCase(), clienteId: c.id, fecha: ahora, tipo: i.tipo, autor: u.email, comentario: `${i.comentario} (vía Alexia)` });
      const estado = c.estado === "Nuevo" ? "Contactado" : c.estado;
      await store.update("clientes", {
        ...c, estado, actualizado: ahora,
        proximaAccion: i.proxima_accion ?? c.proximaAccion, fechaProximaAccion: i.fecha_proxima_accion ?? c.fechaProximaAccion,
      });
      const lines: [string, string][] = [["Cliente", c.nombre], ["Tipo", i.tipo], ["Nota", i.comentario]];
      if (i.proxima_accion || i.fecha_proxima_accion) lines.push(["Próxima acción", [i.proxima_accion, i.fecha_proxima_accion].filter(Boolean).join(" · ")]);
      cards.push({ id: `card-${Date.now()}`, title: "Anotado en la bitácora", lines, status: "done", result: process.env.DATA_SOURCE === "excel" ? "Guardado en el Excel" : "Guardado en el CRM" });
      return `Hecho: anotado en la bitácora de ${c.nombre} (id ${c.id}).`;
    },
  });

  const err = (e: unknown) => (e instanceof MutacionError ? e.message : "No se ha podido completar.");
  const card = (title: string, lines: [string, string][], extra: Partial<ActionCard> = {}) =>
    cards.push({ id: `card-${Date.now()}-${cards.length}`, title, lines, status: "done", result: process.env.DATA_SOURCE === "excel" ? "Guardado en el Excel" : "Guardado en el CRM", ...extra });
  const opcional = z.string().max(300).optional();
  const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD");

  const crear = defineTool({
    name: "crear_prospecto",
    description: "Da de alta un prospecto nuevo. Si existe uno con nombre parecido, devuelve un aviso salvo que forzar=true.",
    inputSchema: z.object({
      nombre: z.string().min(1).max(200),
      grupo: z.enum(GRUPOS).optional().describe("Solo si la persona ve ambos grupos"),
      zona: opcional, contacto: opcional, cargo: opcional, email: opcional, telefono: opcional,
      canal: z.enum(CANALES).optional(), origen: opcional, calidad: z.enum(CALIDADES).optional(), prioridad: z.enum(PRIORIDADES).optional(),
      etiquetas: z.array(z.string().max(60)).max(20).optional(),
      responsable: z.string().max(100).optional().describe("Nombre o email del propietario; por defecto, quien lo pide"),
      proxima_accion: opcional, fecha_proxima_accion: fechaIso, notas: z.string().max(4000).optional(),
      forzar: z.boolean().optional().describe("true para crearlo aunque haya otro con nombre parecido (tras confirmarlo la persona)"),
    }),
    run: async (i) => {
      try {
        if (!i.forzar) {
          const sim = await parecidos(u, i.nombre);
          if (sim.length) return `Ya hay prospectos con nombre parecido: ${sim.map((c) => `${c.nombre} (id ${c.id}, ${c.estado})`).join("; ")}. Pregunta si es el mismo; si no, vuelve a llamar con forzar=true.`;
        }
        const c = await crearProspecto(u, {
          nombre: i.nombre, grupo: i.grupo, zona: i.zona, contacto: i.contacto, cargo: i.cargo, email: i.email, telefono: i.telefono,
          canal: i.canal, origen: i.origen, calidad: i.calidad, prioridad: i.prioridad, etiquetas: i.etiquetas, responsable: i.responsable,
          proximaAccion: i.proxima_accion, fechaProximaAccion: i.fecha_proxima_accion, notas: i.notas,
        });
        const d = await store.readAll();
        card("Prospecto creado", [["Prospecto", c.nombre], ["Grupo", c.grupo], ["Propietario", nombreDe(c.responsable, d.usuarios)],
          ...(c.canal || c.origen ? [["Origen", [c.canal, c.origen].filter(Boolean).join(" · ")] as [string, string]] : []),
          ...(c.etiquetas ? [["Etiquetas", c.etiquetas] as [string, string]] : [])]);
        return `Hecho: creado [${c.nombre}](/clientes/${c.id}) (id ${c.id}).`;
      } catch (e) { return err(e); }
    },
  });

  const actualizar = defineTool({
    name: "actualizar_prospecto",
    description: "Cambia datos de un prospecto o cliente: contacto, zona, canal, origen, calidad, prioridad, estado (Nuevo…Negociación), etiquetas, próxima acción, notas o propietario. Solo envía los campos que cambian.",
    inputSchema: z.object({
      cliente_id: z.string(),
      nombre: opcional, zona: opcional, contacto: opcional, cargo: opcional, email: opcional, telefono: opcional,
      canal: z.enum(CANALES).optional(), origen: opcional, calidad: z.union([z.enum(CALIDADES), z.literal("")]).optional(),
      prioridad: z.union([z.enum(PRIORIDADES), z.literal("")]).optional(),
      estado: z.enum(["Nuevo", "Contactado", "Propuesta enviada", "Negociación"]).optional(),
      etiquetas_anadir: z.array(z.string().max(60)).max(20).optional(), etiquetas_quitar: z.array(z.string().max(60)).max(20).optional(),
      responsable: z.string().max(100).optional().describe("Nombre o email del nuevo propietario, o «sin asignar»"),
      proxima_accion: opcional, fecha_proxima_accion: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
      nota_anadir: z.string().max(4000).optional().describe("Texto que se añade a las notas de la ficha"),
    }),
    run: async (i) => {
      try {
        const { cliente, hechos } = await actualizarProspecto(u, i.cliente_id, {
          nombre: i.nombre, zona: i.zona, contacto: i.contacto, cargo: i.cargo, email: i.email, telefono: i.telefono,
          canal: i.canal, origen: i.origen, calidad: i.calidad, prioridad: i.prioridad, estado: i.estado,
          etiquetasAnadir: i.etiquetas_anadir, etiquetasQuitar: i.etiquetas_quitar, responsable: i.responsable,
          proximaAccion: i.proxima_accion, fechaProximaAccion: i.fecha_proxima_accion, notaAnadir: i.nota_anadir,
        });
        if (!hechos.length) return "No había nada que cambiar: los datos ya eran esos.";
        card(`Ficha actualizada · ${cliente.nombre}`, hechos);
        return `Hecho: actualizado ${cliente.nombre} (${hechos.map(([k]) => k).join(", ")}).`;
      } catch (e) { return err(e); }
    },
  });

  const proyecto = defineTool({
    name: "registrar_proyecto",
    description: "Añade un proyecto nuevo (con importe opcional) a un cliente que ya trabaja con nosotros.",
    inputSchema: z.object({ cliente_id: z.string(), nombre: z.string().min(1).max(200), importe_eur: z.number().min(0).optional(), fecha: fechaIso, notas: z.string().max(2000).optional() }),
    run: async (i) => {
      try {
        const { cliente, proyecto } = await registrarProyecto(u, i.cliente_id, { nombre: i.nombre, importe: i.importe_eur ?? null, fecha: i.fecha, notas: i.notas });
        card("Proyecto registrado", [["Cliente", cliente.nombre], ["Proyecto", proyecto.nombre], ["Importe", proyecto.importe !== null ? `${proyecto.importe.toLocaleString("es-ES")} €` : "—"], ["Fecha", proyecto.fecha]]);
        return `Hecho: proyecto «${proyecto.nombre}» registrado en ${cliente.nombre}.`;
      } catch (e) { return err(e); }
    },
  });

  const preparar = async (id: string) => {
    const d = filtrarDatos(u, await store.readAll());
    const c = d.clientes.find((x) => x.id === id);
    if (!c || !puedeEditar(u, c)) throw new MutacionError("No existe ese prospecto o no tienes permiso sobre él.");
    return c;
  };
  const archivar = defineTool({
    name: "archivar_prospecto",
    description: "Prepara el archivo de un prospecto (pasa a Perdido). NO lo hace: la persona debe confirmarlo en la tarjeta.",
    inputSchema: z.object({ cliente_id: z.string(), motivo: z.string().max(500).optional() }),
    run: async (i) => {
      try {
        const c = await preparar(i.cliente_id);
        if (c.estado === "Ganado") return "Es un cliente ganado; no se archiva.";
        card(`Archivar ${c.nombre}`, [["Prospecto", c.nombre], ["Estado", `${c.estado} → Perdido`], ...(i.motivo ? [["Motivo", i.motivo] as [string, string]] : [])],
          { status: "pending", result: undefined, token: firmar(u.email, { op: "archivar", id: c.id, motivo: i.motivo ?? "" }) });
        return "Preparado: pendiente de que la persona pulse «Confirmar».";
      } catch (e) { return err(e); }
    },
  });
  const ganado = defineTool({
    name: "pasar_a_ganado",
    description: "Prepara el paso de un prospecto a Ganado (primer contrato firmado) con su primer proyecto e importe opcional. NO lo hace: la persona debe confirmarlo en la tarjeta.",
    inputSchema: z.object({ cliente_id: z.string(), nombre_proyecto: z.string().max(200).optional(), importe_eur: z.number().min(0).optional(), fecha: fechaIso, notas: z.string().max(2000).optional() }),
    run: async (i) => {
      try {
        const c = await preparar(i.cliente_id);
        if (c.estado === "Ganado") return "Ya es un cliente ganado; para un proyecto nuevo usa registrar_proyecto.";
        card(`Pasar a Ganado · ${c.nombre}`, [["Cliente", c.nombre], ["Primer proyecto", i.nombre_proyecto || "Primer proyecto"], ["Importe", i.importe_eur !== undefined ? `${i.importe_eur.toLocaleString("es-ES")} €` : "—"], ["Fecha de firma", i.fecha || new Date().toISOString().slice(0, 10)]],
          { status: "pending", result: undefined, token: firmar(u.email, { op: "ganado", id: c.id, nombre: i.nombre_proyecto, importe: i.importe_eur ?? null, fecha: i.fecha, notas: i.notas }) });
        return "Preparado: pendiente de que la persona pulse «Confirmar».";
      } catch (e) { return err(e); }
    },
  });

  return [buscar, ver, resumen, anotar, crear, actualizar, proyecto, archivar, ganado];
}

/** Cliente que la persona tiene abierto en la web (si puede verlo). */
export async function clienteActual(u: Usuario, page?: string | null) {
  const m = page?.match(/^\/clientes\/([^/]+)(?:\/|$)/);
  if (!m || m[1] === "nuevo") return undefined;
  const c = filtrarDatos(u, await store.readAll()).clientes.find((x) => x.id === decodeURIComponent(m[1]!));
  return c ? { id: c.id, nombre: c.nombre, estado: c.estado } : undefined;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantReply = { text: string; actions: ActionCard[] };

export async function askAssistant(u: Usuario, history: ChatTurn[], current?: { id: string; nombre: string; estado: string }): Promise<AssistantReply> {
  const cards: ActionCard[] = [];
  const done = (text: string): AssistantReply => ({ text, actions: cards });
  const alcance = u.rol === "admin" ? "todos los clientes de ambos grupos" : u.rol === "responsable" ? `todos los clientes del grupo ${u.grupo}` : "solo sus propios clientes";
  const who = `Usuario actual: ${u.nombre} (${u.email}). Rol: ${ROL_LABEL[u.rol]}. Grupo: ${u.grupo}. Ve ${alcance}. Hoy es ${new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
Canal: chat del CRM web. Debajo de tu respuesta aparece una tarjeta por cada acción (hecha, o pendiente con botones «Confirmar» y «Cancelar»): no repitas su detalle.${current ? `\nAhora mismo tiene abierta la ficha de ${current.nombre} (${current.estado}; id ${current.id}). Si pregunta o pide algo sin decir de qué cliente («este cliente», «apunta que le he llamado»…), se refiere a este: usa su id sin preguntárselo.` : ""}`;
  const tools = toolsFor(u, cards);
  // API Responses sin guardar nada en OpenAI (store: false); el razonamiento viaja cifrado entre vueltas.
  const input: OpenAI.Responses.ResponseInputItem[] = [
    { role: "developer", content: who },
    ...history.slice(-20).map((t) => ({ role: t.role, content: t.content })),
  ];
  for (let i = 0; i < 6; i++) {
    const res = await getClient().responses.create({
      model: MODEL,
      instructions: GUIDE,
      input,
      tools: tools.map((t) => t.def),
      reasoning: { effort: "low" },
      max_output_tokens: 4000,
      store: false,
      include: ["reasoning.encrypted_content"],
    });
    const refused = res.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
    if (refused) return done("Lo siento, no puedo ayudarte con esa petición.");
    const calls = res.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
    if (!calls.length) return done(res.output_text?.trim() || "No he podido generar una respuesta. ¿Puedes reformular la pregunta?");
    input.push(...(res.output as OpenAI.Responses.ResponseInputItem[]));
    for (const call of calls) {
      const tool = tools.find((t) => t.def.name === call.name);
      let output: string;
      try {
        const parsed = tool?.schema.safeParse(JSON.parse(call.arguments || "{}"));
        output = !tool ? "Herramienta desconocida." : parsed?.success ? await tool.run(parsed.data as never) : "Parámetros no válidos.";
      } catch {
        output = "No se ha podido completar.";
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output });
    }
  }
  return done("La consulta es demasiado compleja. ¿Puedes concretar un poco más?");
}
