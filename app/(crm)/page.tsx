import Link from "next/link";
import { ChartCard, HBars, PorComercial, VBars } from "@/components/Charts";
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
      {filtros.length > 0 && <FilterBar filtros={filtros} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Prospectos abiertos" value={s.kpi.abiertos} hint={`${s.kpi.total} fichas en total`} />
        <Stat label="Clientes ganados" value={s.kpi.ganados} />
        <Stat label="Tasa de conversión" value={s.kpi.conversion === null ? "—" : `${s.kpi.conversion}%`} hint="ganados / (ganados + perdidos)" />
        <Stat label="Importe en proyectos" value={eur(s.kpi.importe)} hint="sin cancelados" />
        <Stat label="Acciones últimos 30 días" value={s.kpi.acciones30} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Embudo comercial" subtitle="Fichas por estado"><HBars data={s.embudo} /></ChartCard>
        <ChartCard title="Canal de procedencia" subtitle="De dónde vienen los leads"><HBars data={s.canales} /></ChartCard>
        <ChartCard title="Actividad comercial" subtitle="Acciones registradas por semana · últimas 12"><VBars data={s.actividad} label="Acciones" /></ChartCard>
        <ChartCard title="Importe de proyectos" subtitle="Por mes · últimos 12"><VBars data={s.importeMes} money label="Importe" /></ChartCard>
        <ChartCard title="Calidad de los prospectos abiertos"><HBars data={s.calidad} /></ChartCard>
        {usuario.rol !== "comercial" && <ChartCard title="Por comercial" subtitle="Prospectos abiertos y clientes ganados"><PorComercial data={s.porComercial} /></ChartCard>}
      </div>

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
