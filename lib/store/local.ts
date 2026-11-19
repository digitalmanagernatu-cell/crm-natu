/**
 * Almacén local en JSON para desarrollo y demos (sin Microsoft 365).
 * Arranca desde data/seed.json y guarda los cambios en data/local-db.json (ignorado por git).
 */
import { promises as fs } from "fs";
import path from "path";
import type { CrmData } from "../types";
import type { TablaKey } from "./schema";
import { claveDe, type Store } from "./store";

const REAL = path.join(process.cwd(), "data", "seed.real.json");
const SEED = path.join(process.cwd(), "data", "seed.json");
// En Vercel el disco es de solo lectura salvo /tmp (los cambios de prueba se pierden al reiniciar).
const DB = process.env.VERCEL ? "/tmp/local-db.json" : path.join(process.cwd(), "data", "local-db.json");

// Caché compartida por todo el proceso (páginas, acciones y API se empaquetan por separado en Next.js
// y cada paquete tendría su propia copia del módulo).
const g = globalThis as unknown as { __crmLocal?: { data: CrmData | null; mtime: number } };
g.__crmLocal ??= { data: null, mtime: 0 };

async function load(): Promise<CrmData> {
  const st = await fs.stat(DB).catch(() => null);
  if (g.__crmLocal!.data && (!st || st.mtimeMs === g.__crmLocal!.mtime)) return g.__crmLocal!.data;
  let cache: CrmData;
  try {
    cache = JSON.parse(await fs.readFile(DB, "utf8"));
    g.__crmLocal!.mtime = st?.mtimeMs ?? 0;
  } catch {
    // Datos reales migrados si existen (no están en git); si no, datos de demostración.
    cache = JSON.parse(await fs.readFile(REAL, "utf8").catch(() => fs.readFile(SEED, "utf8")));
  }
  cache.agenda ??= []; // libros anteriores a la Agenda
  g.__crmLocal!.data = cache;
  return cache;
}

async function save() {
  await fs.writeFile(DB, JSON.stringify(g.__crmLocal!.data, null, 2));
  g.__crmLocal!.mtime = (await fs.stat(DB)).mtimeMs;
}

export const localStore: Store = {
  async readAll() {
    return structuredClone(await load());
  },
  async insert(tabla: TablaKey, item) {
    const d = await load();
    (d[tabla] as unknown[]).push(structuredClone(item));
    await save();
  },
  async update(tabla: TablaKey, item) {
    const d = await load();
    const arr = d[tabla] as unknown as Record<string, unknown>[];
    const k = claveDe(tabla, item as unknown as Record<string, unknown>);
    const i = arr.findIndex((x) => claveDe(tabla, x) === k);
    if (i < 0) throw new Error(`No existe ${tabla} ${k}`);
    arr[i] = structuredClone(item) as unknown as Record<string, unknown>;
    await save();
  },
};
