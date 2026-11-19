/**
 * Almacén sobre el Excel de SharePoint mediante Microsoft Graph (API de Excel).
 *
 * La app se autentica como aplicación (client credentials) con el registro de Entra ID,
 * de modo que los comerciales no necesitan permisos sobre el archivo: el CRM decide qué
 * ve cada uno. Lee las 4 tablas, cachea unos segundos y escribe fila a fila.
 */
import type { CrmData } from "../types";
import { TABLAS, fromRow, type TablaKey } from "./schema";
import { claveDe, type Store } from "./store";

const GRAPH = "https://graph.microsoft.com/v1.0";
const CACHE_MS = Number(process.env.EXCEL_CACHE_SECONDS ?? 20) * 1000;

let token: { value: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID!;
  const secret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  // Si no hay secreto en el entorno, se envía como HTTP Basic (RFC 6749 §2.3.1, lo admite Entra ID):
  // útil cuando un proxy de salida inyecta la credencial y el secreto no debe estar en la app.
  const basic = !secret || process.env.GRAPH_CLIENT_AUTH === "basic";
  const body = new URLSearchParams({ scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
  if (!basic) { body.set("client_id", clientId); body.set("client_secret", secret!); }
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(basic ? { Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(secret || "inyectado-por-proxy")}`).toString("base64")}` } : {}),
    },
    body,
  });
  if (!res.ok) throw new Error(`Error obteniendo token de Graph: ${res.status} ${await res.text()}`);
  const j = await res.json();
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export async function gfetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url.startsWith("http") ? url : GRAPH + url, {
    ...init,
    headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Graph ${init.method ?? "GET"} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

let baseUrl: string | null = null;
/** Resuelve la ruta del libro: por driveId+itemId, o a partir del enlace de compartir. */
export async function workbookBase(): Promise<string> {
  if (baseUrl) return baseUrl;
  const { EXCEL_DRIVE_ID, EXCEL_ITEM_ID, EXCEL_SHARE_URL } = process.env;
  if (EXCEL_DRIVE_ID && EXCEL_ITEM_ID) {
    baseUrl = `/drives/${EXCEL_DRIVE_ID}/items/${EXCEL_ITEM_ID}/workbook`;
  } else if (EXCEL_SHARE_URL) {
    const enc = "u!" + Buffer.from(EXCEL_SHARE_URL).toString("base64url");
    const item = await gfetch(`/shares/${enc}/driveItem`);
    baseUrl = `/drives/${item.parentReference.driveId}/items/${item.id}/workbook`;
    console.info(`[crm] Excel resuelto: EXCEL_DRIVE_ID=${item.parentReference.driveId} EXCEL_ITEM_ID=${item.id}`);
  } else {
    throw new Error("Configura EXCEL_DRIVE_ID + EXCEL_ITEM_ID o EXCEL_SHARE_URL");
  }
  return baseUrl;
}

export async function readTable(t: TablaKey): Promise<{ headers: string[]; rows: unknown[][] }> {
  const base = await workbookBase();
  const r = await gfetch(`${base}/tables/${TABLAS[t].table}/range?$select=values`);
  const [headers, ...rows] = r.values as unknown[][];
  return {
    headers: headers.map(String),
    rows: rows.filter((row) => row.some((v) => v !== "" && v !== null)),
  };
}

let cache: { data: CrmData; at: number } | null = null;
let lock: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = lock.then(fn, fn);
  lock = p.catch(() => undefined);
  return p;
}

function buildRow(headers: string[], cols: readonly { key: unknown; header: string; kind?: string }[], item: Record<string, unknown>, existing?: unknown[]) {
  return headers.map((h, i) => {
    const c = cols.find((c) => c.header.toLowerCase() === h.trim().toLowerCase());
    if (!c) return existing ? existing[i] : ""; // columnas extra del Excel: se respetan
    const v = item[c.key as string];
    if (c.kind === "number") return v === null || v === undefined || v === "" ? "" : Number(v);
    if (c.kind === "bool") return v ? "Sí" : "No";
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Si la tabla del Excel no tiene alguna columna que usa la app (versión nueva), la añade al final. */
async function asegurarColumnas(base: string, tabla: TablaKey, headers: string[]) {
  const t = TABLAS[tabla];
  const faltan = t.cols.filter((c) => !headers.some((h) => h.trim().toLowerCase() === c.header.toLowerCase()));
  for (const c of faltan) {
    await gfetch(`${base}/tables/${t.table}/columns`, { method: "POST", body: JSON.stringify({ name: c.header }) });
    headers.push(c.header);
    console.info(`[crm] Columna «${c.header}» añadida a ${t.table}`);
  }
}

export const graphStore: Store = {
  async readAll() {
    if (cache && Date.now() - cache.at < CACHE_MS) return structuredClone(cache.data);
    const keys = Object.keys(TABLAS) as TablaKey[];
    const tables = await Promise.all(keys.map(readTable));
    const data = Object.fromEntries(
      keys.map((k, i) => [k, tables[i].rows.map((row) => fromRow(TABLAS[k].cols as never, tables[i].headers, row))]),
    ) as unknown as CrmData;
    data.usuarios = data.usuarios.map((u) => ({ ...u, email: u.email.toLowerCase() }));
    cache = { data, at: Date.now() };
    return structuredClone(data);
  },

  insert(tabla, item) {
    return serial(async () => {
      const base = await workbookBase();
      const { headers } = await readTable(tabla);
      await asegurarColumnas(base, tabla, headers);
      const values = [buildRow(headers, TABLAS[tabla].cols, item as unknown as Record<string, unknown>)];
      await gfetch(`${base}/tables/${TABLAS[tabla].table}/rows`, { method: "POST", body: JSON.stringify({ values }) });
      cache = null;
    });
  },

  update(tabla, item) {
    return serial(async () => {
      const base = await workbookBase();
      // Releemos sin filtrar filas vacías para que el índice coincida con el de la tabla.
      const r = await gfetch(`${base}/tables/${TABLAS[tabla].table}/range?$select=values`);
      const [headersRaw, ...rows] = r.values as unknown[][];
      const headers = headersRaw.map(String);
      const antes = headers.length;
      await asegurarColumnas(base, tabla, headers);
      if (headers.length > antes) rows.forEach((r) => r.push(...Array(headers.length - antes).fill("")));
      const keyHeader = tabla === "usuarios" ? "email" : "id";
      const ki = headers.findIndex((h) => h.trim().toLowerCase() === keyHeader);
      const k = claveDe(tabla, item as unknown as Record<string, unknown>);
      const idx = rows.findIndex((row) => String(row[ki]).trim().toLowerCase() === k);
      if (idx < 0) throw new Error(`No se encontró ${k} en ${TABLAS[tabla].table}`);
      const values = [buildRow(headers, TABLAS[tabla].cols, item as unknown as Record<string, unknown>, rows[idx])];
      await gfetch(`${base}/tables/${TABLAS[tabla].table}/rows/itemAt(index=${idx})`, {
        method: "PATCH",
        body: JSON.stringify({ values }),
      });
      cache = null;
    });
  },
};
