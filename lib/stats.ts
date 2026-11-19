import { diasDesde, nombreDe } from "./format";
import { CALIDADES, CANALES, ESTADOS, ESTADOS_ABIERTOS, type CrmData } from "./types";

export function ultimaAccion(d: CrmData) {
  const m = new Map<string, string>();
  for (const a of d.acciones) if (!m.has(a.clienteId) || a.fecha > m.get(a.clienteId)!) m.set(a.clienteId, a.fecha);
  return m;
}

function semanaLabel(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function calcularStats(d: CrmData) {
  const abiertos = d.clientes.filter((c) => ESTADOS_ABIERTOS.includes(c.estado));
  const ganados = d.clientes.filter((c) => c.estado === "Ganado");
  const cerrados = ganados.length + d.clientes.filter((c) => c.estado === "Perdido").length;
  const importe = d.proyectos.filter((p) => p.estado !== "Cancelado").reduce((s, p) => s + (p.importe ?? 0), 0);
  const acciones30 = d.acciones.filter((a) => a.tipo !== "Sistema" && diasDesde(a.fecha) <= 30).length;

  const embudo = ESTADOS.map((e) => ({ name: e, value: d.clientes.filter((c) => c.estado === e).length }));
  const canales = [...CANALES, ""].map((k) => ({ name: k || "Sin definir", value: d.clientes.filter((c) => c.canal === k).length }))
    .filter((x) => x.value > 0 || x.name !== "Sin definir");
  const calidad = [...CALIDADES, ""].map((k) => ({ name: k || "Sin calificar", value: abiertos.filter((c) => c.calidad === k).length }));

  // Actividad: acciones por semana (últimas 12), excluyendo las automáticas.
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const actividad = Array.from({ length: 12 }, (_, i) => {
    const ini = new Date(lunes); ini.setDate(ini.getDate() - 7 * (11 - i));
    const fin = new Date(ini); fin.setDate(fin.getDate() + 7);
    return { name: semanaLabel(ini), value: d.acciones.filter((a) => a.tipo !== "Sistema" && +new Date(a.fecha) >= +ini && +new Date(a.fecha) < +fin).length };
  });

  // Importe de proyectos por mes (últimos 12).
  const hoy = new Date();
  const importeMes = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    return {
      name: m.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
      value: d.proyectos.filter((p) => p.estado !== "Cancelado" && p.fecha.startsWith(key)).reduce((s, p) => s + (p.importe ?? 0), 0),
    };
  });

  const responsables = [...new Set(d.clientes.map((c) => c.responsable))];
  const porComercial = responsables
    .map((r) => ({
      name: nombreDe(r, d.usuarios),
      Abiertos: abiertos.filter((c) => c.responsable === r).length,
      Ganados: ganados.filter((c) => c.responsable === r).length,
    }))
    .sort((a, b) => b.Abiertos + b.Ganados - (a.Abiertos + a.Ganados));

  const ult = ultimaAccion(d);
  const hoyIso = new Date().toISOString().slice(0, 10);
  const atencion = abiertos
    .map((c) => {
      const dias = diasDesde(ult.get(c.id) ?? c.fechaAlta);
      const vencida = !!c.fechaProximaAccion && c.fechaProximaAccion < hoyIso;
      return { c, dias, vencida };
    })
    .filter((x) => x.vencida || x.dias >= 14)
    .sort((a, b) => Number(b.vencida) - Number(a.vencida) || b.dias - a.dias);

  return {
    kpi: {
      abiertos: abiertos.length,
      ganados: ganados.length,
      conversion: cerrados ? Math.round((ganados.length / cerrados) * 100) : null,
      importe,
      acciones30,
      total: d.clientes.length,
    },
    embudo, canales, calidad, actividad, importeMes, porComercial, atencion,
  };
}
