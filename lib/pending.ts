import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Acciones de Alexia pendientes de confirmación, sin base de datos: la operación viaja firmada
 * (HMAC con AUTH_SECRET) en la tarjeta del chat y solo la puede ejecutar la misma persona,
 * durante 30 minutos.
 */
export type Pendiente =
  | { op: "archivar"; id: string; motivo: string }
  | { op: "ganado"; id: string; nombre?: string; importe?: number | null; fecha?: string; notas?: string };

const secreto = () => process.env.AUTH_SECRET || "dev";
const firma = (s: string) => createHmac("sha256", secreto()).update(s).digest("base64url");

export function firmar(email: string, p: Pendiente) {
  const body = Buffer.from(JSON.stringify({ ...p, u: email, exp: Date.now() + 30 * 60_000 })).toString("base64url");
  return `${body}.${firma(body)}`;
}

export function verificar(email: string, token: string): Pendiente | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const esperado = Buffer.from(firma(body));
  const recibido = Buffer.from(sig);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  const j = JSON.parse(Buffer.from(body, "base64url").toString()) as Pendiente & { u: string; exp: number };
  if (j.u !== email || j.exp < Date.now()) return null;
  const { u: _u, exp: _e, ...p } = j;
  void _u; void _e;
  return p as Pendiente;
}
