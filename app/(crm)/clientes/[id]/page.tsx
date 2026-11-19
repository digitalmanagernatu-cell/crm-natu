import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bitacora } from "@/components/Bitacora";
import { BitacoraForm, EstadoSelect, GanadoButton, ProyectoForm } from "@/components/ClienteActions";
import { Badge, CalidadBadge, EstadoBadge } from "@/components/ui";
import { eur, fecha, nombreDe } from "@/lib/format";
import { datosVisibles } from "@/lib/session";
import { parseTags, tagClass } from "@/lib/tags";

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { datos } = await datosVisibles();
  const c = datos.clientes.find((x) => x.id === id);
  if (!c) notFound();

  const acciones = datos.acciones
    .filter((a) => a.clienteId === id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((a) => ({ ...a, autorNombre: nombreDe(a.autor, datos.usuarios) }));
  const proyectos = datos.proyectos.filter((p) => p.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = proyectos.filter((p) => p.estado !== "Cancelado").reduce((s, p) => s + (p.importe ?? 0), 0);

  const dato = (label: string, v: React.ReactNode) => (
    <div><dt className="text-xs text-muted">{label}</dt><dd className="text-sm">{v || "—"}</dd></div>
  );

  return (
    <>
      <Link href={c.estado === "Ganado" ? "/clientes" : "/prospectos"} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft size={14} /> {c.estado === "Ganado" ? "Clientes" : "Prospectos"}</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EstadoBadge estado={c.estado} />
            <CalidadBadge calidad={c.calidad} />
            <Badge className="bg-surface-2 text-ink-2">{c.grupo}</Badge>
            {c.canal && <Badge className="bg-surface-2 text-ink-2">Canal: {c.canal}</Badge>}
            {c.prioridad && <Badge className="bg-surface-2 text-ink-2">Prioridad {c.prioridad.toLowerCase()}</Badge>}
            {parseTags(c.etiquetas).map((t) => <Badge key={t} className={`uppercase ring-1 ${tagClass(t)}`}>{t}</Badge>)}
            <span className="text-sm text-ink-2">· {nombreDe(c.responsable, datos.usuarios)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EstadoSelect clienteId={c.id} estado={c.estado} />
          {c.estado !== "Ganado" && <GanadoButton clienteId={c.id} />}
          <Link href={`/clientes/${c.id}/editar`} className="btn-ghost"><Pencil size={14} /> Editar</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 text-sm font-semibold">Datos</div>
            <dl className="grid grid-cols-2 gap-3">
              {dato("Contacto", c.contacto)}
              {dato("Cargo", c.cargo)}
              {dato("Email", c.email && <a href={`mailto:${c.email}`} className="break-all text-accent">{c.email}</a>)}
              {dato("Teléfono", c.telefono && <a href={`tel:${c.telefono}`} className="text-accent">{c.telefono}</a>)}
              {dato("Zona / País", c.zona)}
              {dato("Agente inicial", c.agenteInicial)}
              {dato("Origen", c.origen)}
              {dato("Alta", fecha(c.fechaAlta))}
              {dato("Ganado", c.fechaGanado && fecha(c.fechaGanado))}
            </dl>
            {(c.proximaAccion || c.fechaProximaAccion) && (
              <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
                <div className="text-xs text-muted">Próxima acción</div>
                {c.proximaAccion} {c.fechaProximaAccion && <b className={c.fechaProximaAccion < new Date().toISOString().slice(0, 10) ? "text-[var(--bad)]" : ""}>· {fecha(c.fechaProximaAccion)}</b>}
              </div>
            )}
            {c.notas && <p className="mt-4 whitespace-pre-wrap text-sm text-ink-2">{c.notas}</p>}
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-sm font-semibold">Proyectos</div>
              {proyectos.length > 0 && <div className="text-sm font-semibold tabular-nums">{eur(total)}</div>}
            </div>
            {proyectos.length === 0 && <p className="mb-3 text-sm text-muted">{c.estado === "Ganado" ? "Sin proyectos." : "Al pasar a Ganado se registra el primer proyecto."}</p>}
            <ul className="mb-3 divide-y divide-line">
              {proyectos.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2"><span className="font-medium">{p.nombre}</span><span className="tabular-nums">{eur(p.importe)}</span></div>
                  <div className="text-xs text-muted">{fecha(p.fecha)} · {p.estado}{p.notas && ` · ${p.notas}`}</div>
                </li>
              ))}
            </ul>
            {(c.estado === "Ganado" || proyectos.length > 0) && <ProyectoForm clienteId={c.id} />}
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold">Bitácora</div>
          <BitacoraForm clienteId={c.id} />
          <div className="mt-6 border-t border-line pt-4"><Bitacora acciones={acciones} /></div>
        </div>
      </div>
    </>
  );
}
