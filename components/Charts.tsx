"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { name: string; [k: string]: string | number };

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipProps = {
  cursor: { fill: "var(--surface-2)" },
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text-2)" },
};

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="grid h-[220px] place-items-center text-sm text-muted">Sin datos todavía</div>;
}

/** Barras horizontales de una sola serie (embudo, canales, calidad…). */
export function HBars({ data, unit = "", money = false }: { data: Datum[]; unit?: string; money?: boolean }) {
  if (!data.some((d) => Number(d.value) > 0)) return <Empty />;
  const fmt = (v: number) => (money ? v.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : `${v}${unit}`);
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} {...axis} />
        <Tooltip {...tooltipProps} formatter={(v) => [fmt(Number(v)), ""]} separator="" />
        <Bar dataKey="value" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}
          label={{ position: "right", fill: "var(--text-2)", fontSize: 12, formatter: (v: unknown) => (Number(v) ? fmt(Number(v)) : "") }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Embudo vertical: fases de arriba abajo, barras centradas cuyo ancho es el nº de fichas que
 * han llegado al menos a esa fase (la fase actual o una posterior). Así la forma siempre estrecha.
 */
export function Embudo({ fases, perdidos }: { fases: { name: string; actual: number; alcanzado: number }[]; perdidos: number }) {
  const max = Math.max(1, ...fases.map((f) => f.alcanzado));
  if (!fases.some((f) => f.alcanzado > 0)) return <Empty />;
  return (
    <div>
      <div className="space-y-1.5">
        {fases.map((f, i) => {
          const prev = i > 0 ? fases[i - 1]!.alcanzado : 0;
          const pct = (f.alcanzado / max) * 100;
          const conv = i > 0 && prev > 0 ? Math.round((f.alcanzado / prev) * 100) : null;
          return (
            <div key={f.name} className="grid grid-cols-[7.5rem_1fr_5rem] items-center gap-3 text-sm">
              <span className="text-right text-xs text-slate-600">{f.name}</span>
              <div className="flex justify-center" title={`${f.alcanzado} han llegado a «${f.name}» · ${f.actual} están ahora en esta fase`}>
                <div className={`flex h-9 min-w-9 items-center justify-center rounded-md text-xs font-semibold ${f.alcanzado ? "text-white" : "border border-dashed border-slate-300 text-slate-500"}`}
                  style={f.alcanzado ? { width: `${Math.max(pct, 6)}%`, background: i === fases.length - 1 ? "var(--series-2)" : "var(--series-1)", opacity: i === fases.length - 1 ? 1 : 1 - i * 0.12 } : { width: "6%" }}>
                  {f.alcanzado}
                </div>
              </div>
              <span className="text-xs tabular-nums text-slate-500">{conv !== null && f.alcanzado > 0 ? `${conv}% pasa` : ""}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Cada barra cuenta las fichas que han llegado al menos a esa fase. {perdidos > 0 && `Fuera del embudo: ${perdidos} perdido${perdidos === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
