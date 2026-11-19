import type { CrmData } from "../types";
import type { TablaKey } from "./schema";

type Entidad<K extends TablaKey> = CrmData[K][number];

export interface Store {
  readAll(): Promise<CrmData>;
  insert<K extends TablaKey>(tabla: K, item: Entidad<K>): Promise<void>;
  /** Actualiza la fila cuya clave (id o email) coincide. */
  update<K extends TablaKey>(tabla: K, item: Entidad<K>): Promise<void>;
}

export function claveDe(tabla: TablaKey, item: Record<string, unknown>): string {
  return String(tabla === "usuarios" ? item.email : item.id).toLowerCase();
}
