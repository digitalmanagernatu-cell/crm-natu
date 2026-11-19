/**
 * Migra el Excel actual "Mapi. Seguimiento Semanal" (exportado a CSV con ;) al modelo del CRM.
 *
 *   npm run seed -- ruta/al/archivo.csv [salida.json]   (por defecto data/seed.real.json, ignorado por git)
 *
 * - Cada fila con CLIENTE → un cliente del grupo Export.
 * - Las columnas de acción semanal y "Últimos comentarios" → entradas de la bitácora.
 * - Filas que solo traen comentario ("CLIENTE- PAÍS: texto") → cliente nuevo sin asignar.
 * Genera data/seed.real.json (usuarios de ejemplo + datos migrados). NO se sube a git: el repo es público.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { Accion, Cliente, CrmData, Usuario } from "../lib/types";

const file = process.argv[2];
if (!file) throw new Error("Uso: npm run seed -- archivo.csv");
const buf = readFileSync(file);
let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);

const DOMINIO = process.env.EMAIL_DOMAIN ?? "natuaromatic.com";
const HOY = new Date().toISOString().slice(0, 10);

// ⚠️ Usuarios de EJEMPLO: sustitúyelos por los reales en la hoja Usuarios.
const usuarios: Usuario[] = [
  { email: `admin@${DOMINIO}`, nombre: "Administrador", grupo: "Todos", rol: "admin", activo: true },
  { email: `resp.export@${DOMINIO}`, nombre: "Responsable Export", grupo: "Export", rol: "responsable", activo: true },
  { email: `gustavo@${DOMINIO}`, nombre: "Gustavo", grupo: "Export", rol: "comercial", activo: true },
  { email: `resp.granconsumo@${DOMINIO}`, nombre: "Responsable Gran Consumo", grupo: "Gran Consumo", rol: "responsable", activo: true },
  { email: `comercial.gc@${DOMINIO}`, nombre: "Comercial Gran Consumo", grupo: "Gran Consumo", rol: "comercial", activo: true },
];
const emailDe = (nombre: string) => {
  const n = nombre.trim().toLowerCase();
  if (!n || n === "-") return "";
  return usuarios.find((u) => u.nombre.toLowerCase() === n)?.email ?? `${n.split(/\s+/)[0]}@${DOMINIO}`;
};

// Columnas de seguimiento → etiqueta y fecha aproximada (la hoja no guardaba fecha exacta).
const SEGUIMIENTO: { col: number; etiqueta: string; fecha: string }[] = [
  { col: 6, etiqueta: "Sem. 45-46", fecha: "2026-11-13T12:00:00.000Z" },
  { col: 7, etiqueta: "Sem. 47-48", fecha: "2026-11-18T12:00:00.000Z" },
  { col: 8, etiqueta: "Últimos comentarios", fecha: "2026-11-19T12:00:00.000Z" },
];

// Ajustes manuales opcionales para filas de solo comentario cuyo nombre no se deduce bien.
// Archivo data/import-overrides.json (ignorado por git), p. ej.:
//   { "palabra clave en el comentario": { "nombre": "Cliente", "zona": "País", "contacto": "Persona" } }
const OVERRIDES: Record<string, { nombre: string; zona: string; contacto?: string }> =
  existsSync("data/import-overrides.json") ? JSON.parse(readFileSync("data/import-overrides.json", "utf8")) : {};

const clientes: Cliente[] = [];
const acciones: Accion[] = [];
let nc = 0, na = 0;
const nuevoId = () => `C${String(++nc).padStart(4, "0")}`;
const accion = (clienteId: string, fecha: string, comentario: string): Accion => ({
  id: `A${String(++na).padStart(5, "0")}`, clienteId, fecha, tipo: "Nota", autor: "importacion", comentario,
});
const limpio = (s?: string) => { const t = (s ?? "").replace(/ /g, " ").trim(); return t === "-" ? "" : t; };

const filas = text.split(/\r?\n/).slice(1).map((l) => l.split(";"));
for (const f of filas) {
  const nombre = limpio(f[1]);
  if (nombre) {
    const c: Cliente = {
      id: nuevoId(), nombre, grupo: "Export", responsable: emailDe(f[2] ?? ""), agenteInicial: limpio(f[0]),
      zona: limpio(f[3]), contacto: limpio(f[4]), cargo: "", email: limpio(f[5]), telefono: "",
      canal: "", origen: "", calidad: "", prioridad: "", etiquetas: "Export", estado: "Contactado", fechaAlta: HOY, fechaGanado: "",
      proximaAccion: "", fechaProximaAccion: "", notas: "Migrado desde 'Mapi. Seguimiento Semanal'.", actualizado: new Date().toISOString(),
    };
    clientes.push(c);
    for (const s of SEGUIMIENTO) {
      const t = limpio(f[s.col]);
      if (t) acciones.push(accion(c.id, s.fecha, `[${s.etiqueta}] ${t}`));
    }
    continue;
  }
  const comentario = limpio(f[8]);
  if (!comentario) continue;
  const cab = comentario.split(":")[0];
  const key = Object.keys(OVERRIDES).find((k) => cab.toLowerCase().includes(k.toLowerCase()));
  // Si el comentario solo nombra un país que ya es de un cliente (p. ej. "UCRANIA: …"), se añade a ese cliente.
  const mismo = !key && clientes.find((x) => x.zona && x.zona.toLowerCase() === cab.trim().toLowerCase());
  if (mismo) { acciones.push(accion(mismo.id, SEGUIMIENTO[2].fecha, `[Últimos comentarios] ${comentario}`)); continue; }
  const [n, z] = key ? [OVERRIDES[key].nombre, OVERRIDES[key].zona] : cab.split(/\s*-\s*/);
  const c: Cliente = {
    id: nuevoId(), nombre: limpio(n), grupo: "Export", responsable: "", agenteInicial: "MAPI",
    zona: limpio(z), contacto: key ? OVERRIDES[key].contacto ?? "" : "", cargo: "", email: "", telefono: "",
    canal: "", origen: "", calidad: "", prioridad: "", etiquetas: "Export", estado: "Contactado", fechaAlta: HOY, fechaGanado: "",
    proximaAccion: "", fechaProximaAccion: "", notas: "Migrado desde 'Mapi. Seguimiento Semanal' (fila sin datos de cliente).", actualizado: new Date().toISOString(),
  };
  clientes.push(c);
  acciones.push(accion(c.id, SEGUIMIENTO[2].fecha, `[Últimos comentarios] ${comentario}`));
}

const out: CrmData = { clientes, acciones, proyectos: [], usuarios, agenda: [] };
const destino = process.argv[3] ?? "data/seed.real.json";
writeFileSync(destino, JSON.stringify(out, null, 2));
console.log(`OK: ${clientes.length} clientes, ${acciones.length} acciones → ${destino}`);
for (const c of clientes) console.log(` - ${c.id} ${c.nombre} (${c.zona}) → ${c.responsable || "sin asignar"}`);
