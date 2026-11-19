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
