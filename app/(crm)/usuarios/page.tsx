import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { guardarUsuario } from "@/lib/actions";
import { requireUsuario } from "@/lib/session";
import { store } from "@/lib/store";
import { GRUPOS, ROLES, ROL_LABEL } from "@/lib/types";

export default async function Usuarios() {
  const u = await requireUsuario();
  if (u.rol !== "admin") notFound();
  const { usuarios, clientes } = await store.readAll();
  const campos = (x?: (typeof usuarios)[number]) => (
    <>
      <input name="email" defaultValue={x?.email} readOnly={!!x} required placeholder="email@natuaromatic.com" className={`input ${x ? "bg-surface-2" : ""}`} />
      <input name="nombre" defaultValue={x?.nombre} required placeholder="Nombre" className="input" />
      <select name="grupo" defaultValue={x?.grupo ?? "Export"} className="input">{[...GRUPOS, "Todos"].map((g) => <option key={g}>{g}</option>)}</select>
      <select name="rol" defaultValue={x?.rol ?? "comercial"} className="input">{ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</select>
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="activo" defaultChecked={x?.activo ?? true} /> Activo</label>
    </>
  );
  return (
    <>
      <PageHeader title="Usuarios y permisos" subtitle="Se guardan en la hoja Usuarios del Excel. Quien no esté aquí (o esté inactivo) no puede entrar." />
      <div className="card mb-6 p-4 text-sm text-ink-2">
        <b>Comercial</b>: ve y gestiona solo sus clientes. · <b>Responsable de grupo</b>: ve todos los clientes de su grupo y puede reasignarlos. · <b>Administrador</b>: visión total y gestión de usuarios. Un responsable con grupo “Todos” ve ambos grupos.
      </div>
      <div className="space-y-2">
        {usuarios.map((x) => (
          <form key={x.email} action={guardarUsuario} className="card grid items-center gap-2 p-3 sm:grid-cols-[2fr_1.5fr_1fr_1.3fr_auto_auto_auto]">
            {campos(x)}
            <span className="text-xs text-muted">{clientes.filter((c) => c.responsable === x.email).length} clientes</span>
            <button className="btn-ghost">Guardar</button>
          </form>
        ))}
        <form action={guardarUsuario} className="card grid items-center gap-2 border-dashed p-3 sm:grid-cols-[2fr_1.5fr_1fr_1.3fr_auto_auto]">
          {campos()}
          <button className="btn-primary">Añadir</button>
        </form>
      </div>
    </>
  );
}
