import { clsx } from "clsx";
import { CALIDAD_STYLE, ESTADO_STYLE } from "@/lib/format";
import type { Calidad, Estado } from "@/lib/types";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}
export const EstadoBadge = ({ estado }: { estado: Estado }) => <Badge className={ESTADO_STYLE[estado]}>{estado}</Badge>;
export const CalidadBadge = ({ calidad }: { calidad: Calidad | "" }) =>
  calidad ? <Badge className={CALIDAD_STYLE[calidad]}>{calidad}</Badge> : <Badge className="bg-surface-2 text-muted">Sin calificar</Badge>;

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
