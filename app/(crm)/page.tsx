import Link from "next/link";
import { ChartCard, Embudo, HBars } from "@/components/Charts";
import { FilterBar } from "@/components/FilterBar";
import { CalidadBadge, EstadoBadge, PageHeader, Stat } from "@/components/ui";
import { eur, fecha, nombreDe } from "@/lib/format";
import { datosVisibles } from "@/lib/session";
import { calcularStats } from "@/lib/stats";
import { GRUPOS } from "@/lib/types";

const SIN = "sin-asignar";

export default async function Panel({ searchParams }: { searchParams: Promise<{ grupo?: string; resp?: string }> }) {
  const sp = await searchParams;
  const { usuario, datos } = await datosVisibles();
  let clientes = datos.clientes;
  if (sp.grupo) clientes = clientes.filter((c) => c.grupo === sp.grupo);
  if (sp.resp) clientes = clientes.filter((c) => c.responsable === (sp.resp === SIN ? "" : sp.resp));
  const ids = new Set(clientes.map((c) => c.id));
  const d = { ...datos, clientes, acciones: datos.acciones.filter((a) => ids.has(a.clienteId)), proyectos: datos.proyectos.filter((p) => ids.has(p.clienteId)) };
  const s = calcularStats(d);

  const responsables = [...new Set(datos.clientes.map((c) => c.responsable))].map((r) => ({ value: r || SIN, label: nombreDe(r, datos.usuarios) }));
  const filtros = [
    ...(usuario.grupo === "Todos" ? [{ key: "grupo", label: "Grupo", options: GRUPOS.map((g) => ({ value: g, label: g })) }] : []),
    ...(usuario.rol !== "comercial" ? [{ key: "resp", label: "Comercial", options: responsables }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`Hola, ${usuario.nombre.split(" ")[0]}`}
        subtitle={usuario.rol === "admin" ? "Visión global de todos los grupos" : usuario.rol === "responsable" ? `Visión del grupo ${usuario.grupo}` : "Tus clientes y prospectos"}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filtros.length > 0 && <FilterBar filtros={filtros} />}
        <Link href="/prospectos" className="btn-primary ml-auto">Ver listado de prospectos →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Prospectos abiertos" value={s.kpi.abiertos} hint={`${s.kpi.acciones30} acciones en 30 días`} />
        <Stat label="Clientes ganados" value={s.kpi.ganados} />
        <Stat label="Tasa de conversión" value={s.kpi.conversion === null ? "—" : `${s.kpi.conversion}%`} hint="ganados / (ganados + perdidos)" />
        <Stat label="Importe en proyectos" value={eur(s.kpi.importe)} hint="sin cancelados" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Embudo comercial" subtitle="De prospecto nuevo a cliente ganado"><Embudo fases={s.embudoVertical} perdidos={s.perdidos} /></ChartCard>
        <ChartCard title="Canal de procedencia" subtitle="De dónde vienen los leads"><HBars data={s.canales.filter((c) => c.value > 0)} /></ChartCard>
      </div>

      {usuario.rol !== "comercial" && s.porComercial.length > 0 && (
        <div className="card mt-4 overflow-x-auto">
          <div className="px-4 pt-4 text-sm font-semibold">Por comercial</div>
          <table className="mt-2 w-full text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr><th className="px-4 py-2">Comercial</th><th className="px-4 py-2 text-right">Prospectos abiertos</th><th className="px-4 py-2 text-right">Clientes ganados</th></tr>
            </thead>
            <tbody>
              {s.porComercial.map((r) => (
                <tr key={r.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.Abiertos}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.Ganados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card mt-4 p-4">
        <div className="mb-3 text-sm font-semibold">Necesitan atención</div>
        <p className="-mt-2 mb-3 text-xs text-muted">Prospectos abiertos con la próxima acción vencida o sin actividad en 14 días o más</p>
        {s.atencion.length === 0 ? (
          <div className="text-sm text-muted">Todo al día 👌</div>
        ) : (
          <ul className="divide-y divide-line">
            {s.atencion.slice(0, 10).map(({ c, dias, vencida }) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:text-accent">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-muted">{c.zona}</span>
                  <EstadoBadge estado={c.estado} />
                  <CalidadBadge calidad={c.calidad} />
                  <span className="ml-auto text-xs text-ink-2">
                    {vencida ? <span className="text-[var(--bad)]">Acción vencida ({fecha(c.fechaProximaAccion)})</span> : `${dias} días sin actividad`}
                    {" · "}{nombreDe(c.responsable, datos.usuarios)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
