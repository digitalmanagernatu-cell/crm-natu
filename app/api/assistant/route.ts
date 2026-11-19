import OpenAI from "openai";
import { z } from "zod";
import { askAssistant, assistantEnabled, clienteActual } from "@/lib/ai";
import { usuarioActual } from "@/lib/session";

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(40),
  /** Página en la que está la persona (para saber de qué cliente habla). */
  page: z.string().max(300).optional(),
});

/** Alexia en el CRM: solo ve lo que ve el usuario. */
export async function POST(req: Request) {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Sesión no válida" }, { status: 401 });
  if (!assistantEnabled()) return Response.json({ error: "El asistente no está configurado todavía (falta la clave de la API de OpenAI)." }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return Response.json({ error: "Mensaje no válido" }, { status: 400 });
  try {
    const current = await clienteActual(u, parsed.data.page);
    const { text, actions } = await askAssistant(u, parsed.data.messages, current);
    return Response.json({ text, actions });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) return Response.json({ error: "Alexia está muy solicitada ahora mismo. Prueba en unos segundos." }, { status: 429 });
    if (err instanceof OpenAI.APIConnectionError) return Response.json({ error: "No se ha podido conectar con OpenAI. Inténtalo de nuevo en unos segundos." }, { status: 503 });
    if (err instanceof OpenAI.AuthenticationError) return Response.json({ error: "La clave de la API de OpenAI no es válida." }, { status: 503 });
    if (err instanceof OpenAI.NotFoundError) return Response.json({ error: "El modelo configurado en OPENAI_MODEL no existe o tu cuenta no tiene acceso a él." }, { status: 503 });
    console.error("[assistant]", err);
    return Response.json({ error: "No he podido responder. Inténtalo de nuevo." }, { status: 500 });
  }
}
