/**
 * Estructura del libro Excel. Cada entidad es una TABLA de Excel (Insertar > Tabla)
 * en su propia hoja. La app lee y escribe por nombre de tabla y por cabecera, así que
 * se pueden reordenar columnas o añadir columnas extra sin romper nada.
 */
import type { Accion, Cliente, Proyecto, Usuario } from "../types";

type Col<T> = { key: keyof T; header: string; kind?: "text" | "number" | "bool" };

export const CLIENTES_COLS: Col<Cliente>[] = [
  { key: "id", header: "ID" },
  { key: "nombre", header: "Cliente" },
  { key: "grupo", header: "Grupo" },
  { key: "responsable", header: "Responsable (email)" },
  { key: "agenteInicial", header: "Agente inicial" },
  { key: "zona", header: "Zona / País" },
  { key: "contacto", header: "Contacto" },
  { key: "cargo", header: "Cargo" },
  { key: "email", header: "Email" },
  { key: "telefono", header: "Teléfono" },
  { key: "canal", header: "Canal procedencia" },
  { key: "calidad", header: "Calidad" },
  { key: "estado", header: "Estado" },
  { key: "fechaAlta", header: "Fecha alta" },
  { key: "fechaGanado", header: "Fecha ganado" },
  { key: "proximaAccion", header: "Próxima acción" },
  { key: "fechaProximaAccion", header: "Fecha próxima acción" },
  { key: "notas", header: "Notas" },
  { key: "actualizado", header: "Actualizado" },
];

export const ACCIONES_COLS: Col<Accion>[] = [
  { key: "id", header: "ID" },
  { key: "clienteId", header: "ID Cliente" },
  { key: "fecha", header: "Fecha" },
  { key: "tipo", header: "Tipo" },
  { key: "autor", header: "Autor (email)" },
  { key: "comentario", header: "Comentario" },
];

export const PROYECTOS_COLS: Col<Proyecto>[] = [
  { key: "id", header: "ID" },
  { key: "clienteId", header: "ID Cliente" },
  { key: "nombre", header: "Proyecto" },
  { key: "importe", header: "Importe (€)", kind: "number" },
  { key: "fecha", header: "Fecha" },
  { key: "estado", header: "Estado" },
  { key: "autor", header: "Autor (email)" },
  { key: "notas", header: "Notas" },
];

export const USUARIOS_COLS: Col<Usuario>[] = [
  { key: "email", header: "Email" },
  { key: "nombre", header: "Nombre" },
  { key: "grupo", header: "Grupo" },
  { key: "rol", header: "Rol" },
  { key: "activo", header: "Activo", kind: "bool" },
];

export const TABLAS = {
  clientes: { sheet: "Clientes", table: "tblClientes", cols: CLIENTES_COLS },
  acciones: { sheet: "Acciones", table: "tblAcciones", cols: ACCIONES_COLS },
  proyectos: { sheet: "Proyectos", table: "tblProyectos", cols: PROYECTOS_COLS },
  usuarios: { sheet: "Usuarios", table: "tblUsuarios", cols: USUARIOS_COLS },
} as const;
export type TablaKey = keyof typeof TABLAS;

export function toRow<T>(cols: Col<T>[], obj: T): (string | number | boolean)[] {
  return cols.map((c) => {
    const v = obj[c.key] as unknown;
    if (c.kind === "number") return v === null || v === undefined || v === "" ? "" : Number(v);
    if (c.kind === "bool") return v ? "Sí" : "No";
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Excel devuelve fechas como número de serie si la celda tiene formato fecha. */
function excelSerialToIso(n: number): string {
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return n % 1 === 0 ? d.toISOString().slice(0, 10) : d.toISOString();
}

export function fromRow<T>(cols: Col<T>[], headers: string[], row: unknown[]): T {
  const out: Record<string, unknown> = {};
  for (const c of cols) {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === c.header.toLowerCase());
    const raw = i >= 0 ? row[i] : "";
    if (c.kind === "number") {
      out[c.key as string] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
    } else if (c.kind === "bool") {
      out[c.key as string] = ["sí", "si", "true", "1", "x", "yes"].includes(String(raw).trim().toLowerCase());
    } else if (typeof raw === "number" && /fecha|actualizado/i.test(c.header)) {
      out[c.key as string] = excelSerialToIso(raw);
    } else {
      out[c.key as string] = raw === null || raw === undefined ? "" : String(raw).trim();
    }
  }
  return out as T;
}
