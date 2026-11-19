import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/ClienteForm";
import { PageHeader } from "@/components/ui";
import { actualizarCliente } from "@/lib/actions";
import { asignables, puedeEditar, puedeReasignar } from "@/lib/permissions";
import { requireUsuario } from "@/lib/session";
import { store } from "@/lib/store";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUsuario();
  const d = await store.readAll();
  const c = d.clientes.find((x) => x.id === id);
  if (!c || !puedeEditar(u, c)) notFound();
  return (
    <>
      <PageHeader title={`Editar ${c.nombre}`} />
      <ClienteForm action={actualizarCliente.bind(null, id)} cliente={c} usuario={u} asignables={[...asignables(u, d.usuarios), ...d.usuarios.filter((x) => x.email === c.responsable && !x.activo).map((x) => ({ ...x, nombre: `${x.nombre} (inactiva/o)` }))]} puedeReasignar={puedeReasignar(u, c)} submit="Guardar cambios" />
    </>
  );
}
