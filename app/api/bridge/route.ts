import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { definicionesPuente, ejecutarLectura, HERRAMIENTAS_PUENTE } from "@/lib/ai";
import { store } from "@/lib/store";

/**
 * Puente CRM ← otras herramientas de NATU (Alexia de NPD, también en Teams).
 *
 *   GET  /api/bridge            → herramientas disponibles (nombre, descripción, esquema)
 *   POST /api/bridge            → { email, herramienta, input } → { resultado, crm_url }
 *
 * Autenticación servidor a servidor: cabecera «Authorization: Bearer <CRM_BRIDGE_SECRET>».
 * Solo lectura. Se aplica SIEMPRE el rol y grupo que esa persona tiene en la hoja Usuarios del CRM:
 * si no está dada de alta (o está inactiva), no ve nada.
 */
export const maxDuration = 60;

function autorizado(req: Request) {
  const secreto = process.env.CRM_BRIDGE_SECRET;
  if (!secreto || secreto.length < 24) return false;
  const recibido = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const esperado = Buffer.from(secreto);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

const crmUrl = () => (process.env.CRM_PUBLIC_URL || "").replace(/\/$/, "");

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json({ crm_url: crmUrl(), herramientas: definicionesPuente() });
}

const Body = z.object({
  email: z.string().email(),
  herramienta: z.enum(HERRAMIENTAS_PUENTE),
  input: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const email = body.data.email.toLowerCase();
  const { usuarios } = await store.readAll();
  const u = usuarios.find((x) => x.email === email && x.activo);
  if (!u) return Response.json({ resultado: "Esta persona no tiene acceso al CRM (no está dada de alta o está inactiva).", crm_url: crmUrl() });
  try {
    const resultado = await ejecutarLectura(u, body.data.herramienta, body.data.input);
    console.info(`[bridge] ${email} · ${body.data.herramienta}`);
    return Response.json({ resultado, crm_url: crmUrl(), nota: "Enlaces a clientes: <crm_url>/clientes/<id>" });
  } catch (e) {
    console.error("[bridge]", e);
    return Response.json({ error: "No se ha podido consultar el CRM." }, { status: 500 });
  }
}
