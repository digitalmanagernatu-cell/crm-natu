import { revalidatePath } from "next/cache";
import { z } from "zod";
import { archivarProspecto, MutacionError, pasarAGanado } from "@/lib/mutations";
import { verificar } from "@/lib/pending";
import { usuarioActual } from "@/lib/session";

/** Confirmar o cancelar una acción que Alexia ha dejado preparada (archivar, pasar a Ganado). */
export async function POST(req: Request) {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Sesión no válida" }, { status: 401 });
  const body = z.object({ token: z.string().max(4000), decision: z.enum(["confirm", "cancel"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const p = verificar(u.email, body.data.token);
  if (!p) return Response.json({ ok: false, error: "La acción ha caducado o no es tuya. Pídeselo de nuevo a Alexia." }, { status: 400 });
  if (body.data.decision === "cancel") return Response.json({ ok: true, message: "Cancelado: no se ha cambiado nada." });
  try {
    if (p.op === "archivar") {
      const c = await archivarProspecto(u, p.id, p.motivo);
      revalidatePath("/", "layout");
      return Response.json({ ok: true, message: `Hecho: ${c.nombre} archivado (Perdido).` });
    }
    const { cliente, proyecto } = await pasarAGanado(u, p.id, p);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, message: `🎉 Hecho: ${cliente.nombre} pasa a Ganado con «${proyecto.nombre}»${proyecto.importe !== null ? ` (${proyecto.importe.toLocaleString("es-ES")} €)` : ""}.` });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof MutacionError ? e.message : "No se ha podido completar." }, { status: 400 });
  }
}
