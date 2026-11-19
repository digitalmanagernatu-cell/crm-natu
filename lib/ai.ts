import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { diasDesde, nombreDe } from "./format";
import { filtrarDatos, puedeEditar } from "./permissions";
import { calcularStats, ultimaAccion } from "./stats";
import { store } from "./store";
import { CALIDADES, CANALES, ESTADOS, GRUPOS, TIPOS_ACCION, type Usuario } from "./types";

const client = new Anthropic();
const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Herramientas del asistente. TODAS leen los datos ya filtrados por los permisos del usuario,
 * así que la IA nunca ve clientes que el usuario no podría ver en la app.
 */
function herramientas(u: Usuario) {
  const datos = async () => filtrarDatos(u, await store.readAll());

  const buscar = betaZodTool({
    name: "buscar_clientes",
    description: "Busca clientes/prospectos visibles para el usuario con filtros opcionales. Devuelve una lista resumida (máx. 50). Úsala para responder preguntas sobre listas, rankings o recuentos.",
    inputSchema: z.object({
      texto: z.string().optional().describe("Texto libre: nombre, país, contacto, email o notas"),
      estado: z.enum(ESTADOS).optional(),
      calidad: z.enum(CALIDADES).optional(),
      canal: z.enum(CANALES).optional(),
      grupo: z.enum(GRUPOS).optional(),
      responsable: z.string().optional().describe("Nombre o email del comercial"),
      sin_actividad_dias: z.number().optional().describe("Solo los que llevan al menos N días sin acciones"),
    }),
    run: async (f) => {
      const d = await datos();
      const ult = ultimaAccion(d);
      const r = d.clientes
        .map((c) => ({ c, ultima: ult.get(c.id) ?? c.fechaAlta, resp: nombreDe(c.responsable, d.usuarios) }))
        .filter(({ c, ultima, resp }) =>
          (!f.texto || norm([c.nombre, c.zona, c.contacto, c.email, c.notas].join(" ")).includes(norm(f.texto))) &&
          (!f.estado || c.estado === f.estado) && (!f.calidad || c.calidad === f.calidad) && (!f.canal || c.canal === f.canal) &&
          (!f.grupo || c.grupo === f.grupo) &&
          (!f.responsable || norm(`${resp} ${c.responsable}`).includes(norm(f.responsable))) &&
          (!f.sin_actividad_dias || diasDesde(ultima) >= f.sin_actividad_dias));
      return JSON.stringify({
        total: r.length,
        clientes: r.slice(0, 50).map(({ c, ultima, resp }) => ({
          id: c.id, nombre: c.nombre, zona: c.zona, grupo: c.grupo, estado: c.estado, calidad: c.calidad || null,
          canal: c.canal || null, comercial: resp, ultima_actividad: ultima.slice(0, 10), dias_sin_actividad: diasDesde(ultima),
          proxima_accion: c.proximaAccion || null, fecha_proxima_accion: c.fechaProximaAccion || null,
        })),
      });
    },
  });

  const ver = betaZodTool({
    name: "ver_cliente",
    description: "Devuelve la ficha completa de un cliente: datos, bitácora completa de acciones (más reciente primero) y proyectos.",
    inputSchema: z.object({ id: z.string().describe("ID del cliente (obtenido con buscar_clientes)") }),
    run: async ({ id }) => {
      const d = await datos();
      const c = d.clientes.find((x) => x.id === id);
      if (!c) return "No existe o no tienes acceso a ese cliente.";
      return JSON.stringify({
        ...c,
        responsable: nombreDe(c.responsable, d.usuarios),
        bitacora: d.acciones.filter((a) => a.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha))
          .map((a) => ({ fecha: a.fecha.slice(0, 10), tipo: a.tipo, autor: nombreDe(a.autor, d.usuarios), comentario: a.comentario })),
        proyectos: d.proyectos.filter((p) => p.clienteId === id),
      });
    },
  });

  const resumen = betaZodTool({
    name: "resumen_pipeline",
    description: "KPIs y distribución del pipeline visible para el usuario: embudo por estado, canales, calidad, actividad semanal, importe por mes, por comercial y prospectos que necesitan atención.",
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

  const registrar = betaZodTool({
    name: "registrar_accion",
    description: "Añade una entrada a la bitácora de un cliente en nombre del usuario. Úsala SOLO cuando el usuario pida explícitamente apuntar/registrar algo, y confirma después qué has guardado.",
    inputSchema: z.object({
      cliente_id: z.string(),
      tipo: z.enum(TIPOS_ACCION),
      comentario: z.string().min(1),
    }),
    run: async ({ cliente_id, tipo, comentario }) => {
      const d = await store.readAll();
      const c = d.clientes.find((x) => x.id === cliente_id);
      if (!c || !puedeEditar(u, c)) return "No tienes permiso sobre ese cliente.";
      await store.insert("acciones", {
        id: `A-${Date.now().toString(36)}`.toUpperCase(), clienteId: c.id, fecha: new Date().toISOString(),
        tipo, autor: u.email, comentario: `${comentario} (vía asistente IA)`,
      });
      return `Guardado en la bitácora de ${c.nombre}.`;
    },
  });

  return [buscar, ver, resumen, registrar];
}

function sistema(u: Usuario) {
  const alcance = u.rol === "admin" ? "todos los clientes de todos los grupos"
    : u.rol === "responsable" ? `todos los clientes del grupo ${u.grupo}` : "solo sus propios clientes";
  return `Eres el asistente comercial del CRM de Natu (Laboratorios NatuAromatic, fabricante de perfumería, cosmética y fragancias de ambiente). Trabajas con dos líneas comerciales: Export y Gran Consumo.

Hablas con ${u.nombre} (${u.email}), rol ${u.rol}, que tiene acceso a ${alcance}. Las herramientas ya devuelven solo lo que puede ver; no especules sobre clientes que no aparezcan.

Hoy es ${new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Cómo trabajar:
- Responde siempre en español, directo y accionable, como un director comercial experimentado.
- Consulta los datos con las herramientas antes de afirmar nada; cita clientes por su nombre.
- Para resúmenes o próximos pasos de un cliente, lee su bitácora completa con ver_cliente.
- Usa listas o tablas Markdown breves cuando ayuden. Importes en euros.
- Solo escribe en el CRM (registrar_accion) si el usuario lo pide expresamente.
- Si un dato no está en el CRM, dilo en lugar de inventarlo.`;
}

export type ChatMsg = { role: "user" | "assistant"; content: string };

export async function responder(u: Usuario, historial: ChatMsg[]): Promise<string> {
  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: sistema(u),
    tools: herramientas(u),
    messages: historial.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    max_iterations: 12,
  });
  if (final.stop_reason === "refusal") return "No puedo ayudar con esa petición.";
  const texto = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  return texto || "No he podido generar una respuesta. ¿Puedes reformular la pregunta?";
}
