import { ClienteForm } from "@/components/ClienteForm";
import { PageHeader } from "@/components/ui";
import { crearCliente } from "@/lib/actions";
import { asignables } from "@/lib/permissions";
import { requireUsuario } from "@/lib/session";
import { store } from "@/lib/store";

export default async function Nuevo() {
  const u = await requireUsuario();
  const { usuarios } = await store.readAll();
  return (
    <>
      <PageHeader title="Nuevo prospecto" subtitle="Se añadirá como fila nueva en la hoja Clientes del Excel" />
      <ClienteForm action={crearCliente} usuario={u} asignables={asignables(u, usuarios)} puedeReasignar={u.rol !== "comercial"} submit="Crear prospecto" />
    </>
  );
}
