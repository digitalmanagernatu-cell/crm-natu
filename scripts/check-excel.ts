/**
 * Comprueba la conexión con el Excel (SharePoint u OneDrive) antes de arrancar el CRM.
 *
 *   npm run check:excel        (lee las variables de .env.local)
 *
 * Verifica: credenciales de Entra ID, acceso al archivo, que existan las 4 tablas
 * y que tengan las cabeceras que usa la app. Solo lee; no escribe nada.
 */
import { TABLAS, type TablaKey } from "../lib/store/schema";
import { gfetch, readTable, workbookBase } from "../lib/store/graph";

const ok = (m: string) => console.log(`  ✅ ${m}`);
const ko = (m: string) => console.log(`  ❌ ${m}`);

async function main() {
  console.log("1. Variables");
  const faltan = ["AUTH_MICROSOFT_ENTRA_ID_ID", "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID", ...(process.env.GRAPH_CLIENT_AUTH === "basic" ? [] : ["AUTH_MICROSOFT_ENTRA_ID_SECRET"])].filter((k) => !process.env[k]);
  if (!process.env.EXCEL_SHARE_URL && !(process.env.EXCEL_DRIVE_ID && process.env.EXCEL_ITEM_ID)) faltan.push("EXCEL_SHARE_URL (o EXCEL_DRIVE_ID + EXCEL_ITEM_ID)");
  if (faltan.length) { faltan.forEach((f) => ko(`Falta ${f}`)); process.exit(1); }
  ok("Completas");

  console.log("2. Acceso al archivo");
  let base: string;
  try {
    base = await workbookBase();
    ok(`Libro encontrado (${base})`);
  } catch (e) {
    ko(String(e instanceof Error ? e.message : e));
    console.log("     Revisa: permiso de aplicación Files.ReadWrite.All (OneDrive) o Sites.Selected con acceso al sitio (SharePoint), y que se haya concedido el consentimiento de administrador.");
    process.exit(1);
  }

  console.log("3. Tablas");
  const { value } = await gfetch(`${base}/tables?$select=name`);
  const existentes = new Set((value as { name: string }[]).map((t) => t.name));
  let errores = 0;
  for (const k of Object.keys(TABLAS) as TablaKey[]) {
    const t = TABLAS[k];
    if (!existentes.has(t.table)) {
      if (k === "agenda") { ok(`${t.table}: no existe todavía; el CRM la creará sola al programar la primera acción`); continue; }
      ko(`Falta la tabla ${t.table} (pestaña ${t.sheet}). Cópiala desde CRM_Natu.xlsx con «Mover o copiar».`); errores++; continue;
    }
    const { headers, rows } = await readTable(k);
    const norm = headers.map((h) => h.trim().toLowerCase());
    const sinCol = t.cols.filter((c) => !norm.includes(c.header.toLowerCase())).map((c) => c.header);
    if (sinCol.length) { ko(`${t.table}: faltan columnas ${sinCol.join(", ")}`); errores++; }
    else ok(`${t.table}: ${rows.length} filas${headers.length > t.cols.length ? ` (+${headers.length - t.cols.length} columnas extra, se respetan)` : ""}`);
  }
  console.log(errores ? `\n${errores} problema(s). Corrígelos y vuelve a ejecutar.` : "\nTodo listo: pon DATA_SOURCE=excel y arranca el CRM.");
  process.exit(errores ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
