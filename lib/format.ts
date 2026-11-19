import type { Calidad, Estado, Usuario } from "./types";

export const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const fecha = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(+d) ? iso : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
};

export const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const diasDesde = (iso: string) => (iso ? Math.floor((Date.now() - +new Date(iso)) / 86_400_000) : Infinity);

export function nombreDe(email: string, usuarios: Pick<Usuario, "email" | "nombre">[]) {
  if (!email) return "Sin asignar";
  if (email === "importacion") return "Importación Excel";
  return usuarios.find((u) => u.email === email)?.nombre || email.split("@")[0];
}

// Colores de estado según DESIGN.md de NATU: suaves, con anillo; lo positivo en salvia.
export const ESTADO_STYLE: Record<Estado, string> = {
  Nuevo: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  Contactado: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  "Propuesta enviada": "bg-[#fbeee9] text-[#8a4b3f] ring-1 ring-natu-peach",
  Negociación: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  Ganado: "bg-[#eef0e6] text-[#56613f] ring-1 ring-natu-sage",
  Perdido: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export const CALIDAD_STYLE: Record<Calidad, string> = {
  "A · Caliente": "bg-[#fbecea] text-[#9a4a3e] ring-1 ring-natu-salmon",
  "B · Templado": "bg-[#fbf3ec] text-[#8a5a3f] ring-1 ring-natu-peach",
  "C · Frío": "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
};
