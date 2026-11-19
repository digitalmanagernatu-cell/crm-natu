/**
 * Genera CRM_Natu.xlsx con las 4 tablas que espera la app (+ hoja Listas) a partir de data/seed.json.
 * Súbelo a SharePoint y apunta EXCEL_SHARE_URL (o DRIVE/ITEM ID) a él.
 *
 *   npm run workbook [-- salida.xlsx [datos.json]]   → CRM_Natu.xlsx (usa data/seed.real.json si existe)
 */
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "fs";
import { TABLAS, toRow, type TablaKey } from "../lib/store/schema";
import { CALIDADES, CANALES, ESTADOS, ESTADOS_PROYECTO, ESTADOS_TAREA, GRUPOS, PRIORIDADES, ROLES, TIPOS_ACCION, type CrmData } from "../lib/types";

const entrada = process.argv[3] ?? (existsSync("data/seed.real.json") ? "data/seed.real.json" : "data/seed.json");
const data: CrmData = JSON.parse(readFileSync(entrada, "utf8"));
console.log(`Datos: ${entrada}`);
const wb = new ExcelJS.Workbook();

for (const k of Object.keys(TABLAS) as TablaKey[]) {
  const t = TABLAS[k];
  const ws = wb.addWorksheet(t.sheet);
  const rows = ((data[k] ?? []) as never[]).map((it) => toRow(t.cols as never, it));
  ws.addTable({
    name: t.table,
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: t.cols.map((c) => ({ name: c.header, filterButton: true })),
    // Una tabla de Excel necesita al menos una fila; si no hay datos, una vacía.
    rows: rows.length ? rows : [t.cols.map(() => "")],
  });
  t.cols.forEach((c, i) => (ws.getColumn(i + 1).width = Math.min(60, Math.max(12, c.header.length + 4))));
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

const listas = wb.addWorksheet("Listas");
const cols: [string, readonly string[]][] = [
  ["Grupos", GRUPOS], ["Roles", ROLES], ["Calidad", CALIDADES], ["Canales", CANALES],
  ["Estados", ESTADOS], ["Prioridad", PRIORIDADES], ["Tipos de acción", TIPOS_ACCION], ["Estados proyecto", ESTADOS_PROYECTO], ["Estados agenda", ESTADOS_TAREA],
];
cols.forEach(([h, vals], i) => {
  listas.getCell(1, i + 1).value = h;
  listas.getCell(1, i + 1).font = { bold: true };
  vals.forEach((v, j) => (listas.getCell(j + 2, i + 1).value = v));
  listas.getColumn(i + 1).width = 20;
});

const out = process.argv[2] ?? "CRM_Natu.xlsx";
wb.xlsx.writeFile(out).then(() => console.log(`OK → ${out}`));
