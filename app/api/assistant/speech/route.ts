import { z } from "zod";
import { assistantEnabled } from "@/lib/ai";
import { usuarioActual } from "@/lib/session";
import { speak } from "@/lib/voice";

export const maxDuration = 60;

/** Respuesta de Alexia → audio (mp3). */
export async function POST(req: Request) {
  const u = await usuarioActual();
  if (!u) return new Response("Sesión no válida", { status: 401 });
  if (!assistantEnabled()) return new Response("Asistente no configurado", { status: 503 });
  const body = z.object({ text: z.string().trim().min(1).max(6000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return new Response("Texto no válido", { status: 400 });
  try {
    return new Response(await speak(body.data.text), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[assistant:speech]", err);
    return new Response("No se ha podido generar el audio", { status: 502 });
  }
}
