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
const DB = path.join(process.cwd(), "data", "local-db.json");

let cache: CrmData | null = null;

async function load(): Promise<CrmData> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(DB, "utf8"));
  } catch {
    // Datos reales migrados si existen (no están en git); si no, datos de demostración.
    cache = JSON.parse(await fs.readFile(REAL, "utf8").catch(() => fs.readFile(SEED, "utf8")));
  }
  return cache!;
}

async function save() {
  await fs.writeFile(DB, JSON.stringify(cache, null, 2));
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
