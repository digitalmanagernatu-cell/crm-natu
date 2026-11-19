/** Etiquetas libres: se guardan como texto separado por comas en la columna «Etiquetas». */
export const parseTags = (s: string) => [...new Set(s.split(",").map((t) => t.trim()).filter(Boolean))];
export const joinTags = (t: string[]) => [...new Set(t.map((x) => x.trim()).filter(Boolean))].join(", ");

// Colores suaves de la paleta NATU + semánticos (fondo, texto, anillo). Cada etiqueta siempre el mismo.
const PALETA = [
  "bg-[#eef0e6] text-[#56613f] ring-[#d3d7c4]",
  "bg-[#fbecea] text-[#9a4a3e] ring-[#e2a29a]",
  "bg-[#fbf3ec] text-[#8a5a3f] ring-[#e4bca5]",
  "bg-sky-50 text-sky-800 ring-sky-200",
  "bg-[#f4f1e8] text-[#6b5f3a] ring-[#dcd5be]",
  "bg-violet-50 text-violet-800 ring-violet-200",
  "bg-teal-50 text-teal-800 ring-teal-200",
  "bg-slate-100 text-slate-700 ring-slate-300",
];
const FIJOS: Record<string, string> = {
  descartado: "bg-rose-50 text-rose-700 ring-rose-200",
  "no viable": "bg-rose-50 text-rose-700 ring-rose-200",
  cliente: "bg-[#eef0e6] text-[#56613f] ring-[#96a27a]",
};
export function tagClass(tag: string) {
  const k = tag.trim().toLowerCase();
  if (FIJOS[k]) return FIJOS[k];
  let h = 0;
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
