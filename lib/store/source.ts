/** Valor de una variable de entorno sin espacios ni comillas alrededor. */
export const envLimpio = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

/** DATA_SOURCE=excel (tolerante con mayúsculas, espacios y comillas) usa el Excel. */
export const usaExcel = () => envLimpio(process.env.DATA_SOURCE).toLowerCase() === "excel";
