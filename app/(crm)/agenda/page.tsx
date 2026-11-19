import { AgendaView, type ItemAgenda } from "@/components/AgendaView";
import { nombreDe } from "@/lib/format";
import { asignables } from "@/lib/permissions";
import { datosVisibles } from "@/lib/session";

export default async function Agenda() {
  const { usuario, datos } = await datosVisibles();
  const items: ItemAgenda[] = datos.agenda.map((t) => {
    const c = datos.clientes.find((x) => x.id === t.clienteId)!;
    return { ...t, clienteNombre: c.nombre, clienteEstado: c.estado, responsableNombre: nombreDe(t.responsable, datos.usuarios) };
  });
  const personas = [...new Set(items.map((t) => t.responsable))].map((e) => ({ value: e, label: nombreDe(e, datos.usuarios) })).sort((a, b) => a.label.localeCompare(b.label));
  const clientes = datos.clientes.filter((c) => c.estado !== "Perdido").map((c) => ({ value: c.id, label: c.nombre })).sort((a, b) => a.label.localeCompare(b.label));
  const asign = usuario.rol === "comercial" ? [{ value: usuario.email, label: usuario.nombre }] : asignables(usuario, datos.usuarios).map((u) => ({ value: u.email, label: u.nombre }));
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Agenda</h1>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        {usuario.rol === "admin" ? "Todas las acciones programadas." : usuario.rol === "responsable" ? `Tus acciones y las de tu equipo (${usuario.grupo}).` : "Tus acciones comerciales programadas."}
      </p>
      <AgendaView items={items} personas={personas} clientes={clientes} asignables={asign} yo={usuario.email} verEquipo={usuario.rol !== "comercial"} />
    </>
  );
}
