import Link from "next/link";
import { ClientesTable, type Fila } from "@/components/ClientesTable";
import { PageHeader } from "@/components/ui";
import { nombreDe } from "@/lib/format";
import { datosVisibles } from "@/lib/session";
import { ultimaAccion } from "@/lib/stats";

export default async function Clientes() {
  const { usuario, datos } = await datosVisibles();
  const ult = ultimaAccion(datos);
  const filas: Fila[] = datos.clientes.map((c) => ({
    ...c,
    responsableNombre: nombreDe(c.responsable, datos.usuarios),
    ultima: ult.get(c.id) ?? c.fechaAlta,
    numProyectos: datos.proyectos.filter((p) => p.clienteId === c.id).length,
  }));
  const responsables = [...new Set(datos.clientes.map((c) => c.responsable))].map((r) => ({ value: r || "sin-asignar", label: nombreDe(r, datos.usuarios) }));
  return (
    <>
      <PageHeader title="Clientes y prospectos" actions={<Link href="/clientes/nuevo" className="btn-primary">+ Nuevo prospecto</Link>} />
      <ClientesTable filas={filas} mostrarGrupo={usuario.grupo === "Todos"} responsables={responsables} />
    </>
  );
}
