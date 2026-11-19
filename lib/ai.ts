import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { diasDesde, nombreDe } from "./format";
import { filtrarDatos, puedeEditar } from "./permissions";
import { calcularStats, ultimaAccion } from "./stats";
import { store } from "./store";
import { CALIDADES, CANALES, ESTADOS, GRUPOS, ROL_LABEL, TIPOS_ACCION, type Usuario } from "./types";

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
- No puedes pasar clientes a Ganado, crear clientes, cambiar estados ni registrar proyectos: explica dónde se hace en el CRM.

Cómo funciona el CRM:
- Dos grupos: Export y Gran Consumo. Roles: Comercial (ve solo sus clientes), Responsable de grupo (ve todo su grupo y reasigna), Administrador (todo, y gestiona usuarios en «Usuarios»).
- Los datos viven en un Excel de SharePoint (hojas Clientes, Acciones, Proyectos y Usuarios); todo lo que se hace en el CRM se escribe allí.
- Estados del embudo: Nuevo, Contactado, Propuesta enviada, Negociación, Ganado, Perdido. La primera acción de la bitácora pasa un prospecto de Nuevo a Contactado.
- Calidad del prospecto: A · Caliente, B · Templado, C · Frío. Canal de procedencia: Feria, Prospección, Email, Web, Ads, LinkedIn, Otro.
- Nuevo prospecto: botón «Nuevo prospecto» de la cabecera.
- Ficha del cliente: datos, bitácora (añadir acción con tipo, fecha y comentario, y opcionalmente «Programar próxima acción»), selector de estado, botón «Pasar a Ganado» (cuando se firma el primer contrato: pide nombre del primer proyecto e importe opcional) y tarjeta «Proyectos» con «+ Nuevo proyecto» para clientes que ya trabajan con nosotros.
- Panel: indicadores, gráficas (embudo, canales, actividad, importe, calidad, por comercial) y «Necesitan atención»: prospectos abiertos con acción vencida o 14 días o más sin actividad.
- Clientes: buscador y filtros por estado, calidad, canal, grupo y comercial.`;

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
export type ActionCard = { id: string; title: string; lines: [string, string][]; status: "done" | "failed"; result?: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Herramientas: todas trabajan sobre los datos ya filtrados por los permisos del usuario. */
function toolsFor(u: Usuario, cards: ActionCard[]) {
  const datos = async () => filtrarDatos(u, await store.readAll());

  const buscar = defineTool({
    name: "buscar_clientes",
    description: "Busca y cuenta clientes y prospectos visibles para el usuario. Devuelve el total y como máximo 40.",
    inputSchema: z.object({
      texto: z.string().max(200).optional().describe("Nombre, país, contacto, email o notas (no distingue tildes)"),
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
          (!f.texto || f.texto.split(/\s+/).every((w) => norm([c.nombre, c.zona, c.contacto, c.email, c.notas].join(" ")).includes(norm(w)))) &&
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
          canal: c.canal || null, comercial: resp, ultima_actividad: ultima.slice(0, 10), dias_sin_actividad: diasDesde(ultima),
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
      cards.push({ id: `card-${Date.now()}`, title: "Anotado en la bitácora", lines, status: "done", result: "Guardado en el Excel" });
      return `Hecho: anotado en la bitácora de ${c.nombre} (id ${c.id}).`;
    },
  });

  return [buscar, ver, resumen, anotar];
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
Canal: chat del CRM web.${current ? `\nAhora mismo tiene abierta la ficha de ${current.nombre} (${current.estado}; id ${current.id}). Si pregunta o pide algo sin decir de qué cliente («este cliente», «apunta que le he llamado»…), se refiere a este: usa su id sin preguntárselo.` : ""}`;
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
