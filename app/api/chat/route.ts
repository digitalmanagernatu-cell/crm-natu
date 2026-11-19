import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { responder } from "@/lib/ai";
import { usuarioActual } from "@/lib/session";

export const maxDuration = 120;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).min(1),
});

export async function POST(req: Request) {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Falta configurar ANTHROPIC_API_KEY" }, { status: 503 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  try {
    return Response.json({ reply: await responder(u, parsed.data.messages) });
  } catch (e) {
    console.error("[chat]", e);
    const msg = e instanceof Anthropic.RateLimitError ? "Demasiadas peticiones, espera un momento."
      : e instanceof Anthropic.APIError ? `Error del servicio de IA (${e.status}).` : "Error inesperado.";
    return Response.json({ error: msg }, { status: 502 });
  }
}
