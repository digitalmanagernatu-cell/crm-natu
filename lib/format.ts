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

export const ESTADO_STYLE: Record<Estado, string> = {
  Nuevo: "bg-surface-2 text-ink-2",
  Contactado: "bg-[#e6effb] text-[#1d5aa6] dark:bg-[#1b2a40] dark:text-[#8fb8f0]",
  "Propuesta enviada": "bg-[#efeafd] text-[#4b3bb3] dark:bg-[#26213f] dark:text-[#b3a9f2]",
  Negociación: "bg-[var(--warn-bg)] text-[var(--warn)]",
  Ganado: "bg-[var(--good-bg)] text-[var(--good)]",
  Perdido: "bg-[var(--bad-bg)] text-[var(--bad)]",
};

export const CALIDAD_STYLE: Record<Calidad, string> = {
  "A · Caliente": "bg-[var(--bad-bg)] text-[var(--bad)]",
  "B · Templado": "bg-[var(--warn-bg)] text-[var(--warn)]",
  "C · Frío": "bg-[#e6effb] text-[#1d5aa6] dark:bg-[#1b2a40] dark:text-[#8fb8f0]",
};
