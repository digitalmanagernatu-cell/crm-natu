import { ClientesGanados, type FilaCliente } from "@/components/ClientesGanados";
import { nombreDe } from "@/lib/format";
import { datosVisibles } from "@/lib/session";
import { ultimaAccion } from "@/lib/stats";

export default async function Clientes() {
  const { usuario, datos } = await datosVisibles();
  const ult = ultimaAccion(datos);
  const filas: FilaCliente[] = datos.clientes.filter((c) => c.estado === "Ganado").map((c) => {
    const proys = datos.proyectos.filter((p) => p.clienteId === c.id && p.estado !== "Cancelado");
    return { ...c, responsableNombre: nombreDe(c.responsable, datos.usuarios), ultima: ult.get(c.id) ?? c.fechaAlta, numProyectos: proys.length, importe: proys.reduce((s, p) => s + (p.importe ?? 0), 0) };
  });
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Clientes</h1>
      <ClientesGanados filas={filas} mostrarGrupo={usuario.grupo === "Todos"} />
    </>
  );
}
