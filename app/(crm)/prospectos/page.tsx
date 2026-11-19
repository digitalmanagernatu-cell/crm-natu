import { ProspectosTable, type FilaProspecto } from "@/components/ProspectosTable";
import { nombreDe } from "@/lib/format";
import { asignables } from "@/lib/permissions";
import { datosVisibles } from "@/lib/session";
import { ultimaAccion } from "@/lib/stats";

export default async function Prospectos() {
  const { usuario, datos } = await datosVisibles();
  const ult = ultimaAccion(datos);
  const filas: FilaProspecto[] = datos.clientes
    .filter((c) => c.estado !== "Ganado")
    .map((c) => ({ ...c, responsableNombre: nombreDe(c.responsable, datos.usuarios), ultima: ult.get(c.id) ?? c.fechaAlta }));
  const responsables = [...new Set(filas.map((c) => c.responsable))].map((r) => ({ value: r || "sin-asignar", label: nombreDe(r, datos.usuarios) }));
  const asign = usuario.rol === "comercial" ? [] : asignables(usuario, datos.usuarios).map((u) => ({ value: u.email, label: u.nombre }));
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Prospectos</h1>
      <ProspectosTable filas={filas} responsables={responsables} asignables={asign} mostrarGrupo={usuario.grupo === "Todos"} />
    </>
  );
}
