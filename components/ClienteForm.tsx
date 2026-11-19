import { CALIDADES, CANALES, ESTADOS, GRUPOS, PRIORIDADES, type Cliente, type Usuario } from "@/lib/types";

const vacio: Partial<Cliente> = { estado: "Nuevo", etiquetas: "" };

export function ClienteForm({ action, cliente = vacio, usuario, asignables, puedeReasignar, submit }: {
  action: (f: FormData) => Promise<void>;
  cliente?: Partial<Cliente>;
  usuario: Usuario;
  asignables: Usuario[];
  puedeReasignar: boolean;
  submit: string;
}) {
  const t = (k: keyof Cliente, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} name={k} defaultValue={String(cliente[k] ?? "")} className="input" {...props} />
    </div>
  );
  const s = (k: keyof Cliente, label: string, opts: readonly string[], vacioLabel?: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <select id={k} name={k} defaultValue={String(cliente[k] ?? "")} className="input">
        {vacioLabel !== undefined && <option value="">{vacioLabel}</option>}
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  const grupoFijo = usuario.grupo !== "Todos" || !puedeReasignar;
  const grupoDefecto = cliente.grupo ?? (usuario.grupo === "Todos" ? "Export" : usuario.grupo);
  // En edición el estado "Ganado" se gestiona con su botón; aquí se permite mantenerlo.
  return (
    <form action={action} className="card space-y-6 p-6">
      <section className="grid gap-4 sm:grid-cols-2">
        {t("nombre", "Nombre del cliente / empresa *", { required: true, autoFocus: true })}
        {t("zona", "Zona / País")}
        {t("contacto", "Persona de contacto")}
        {t("cargo", "Cargo")}
        {t("email", "Email", { type: "email" })}
        {t("telefono", "Teléfono")}
      </section>
      <section className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
        {s("canal", "Canal de procedencia", CANALES, "Sin definir")}
        {t("origen", "Origen (detalle)", { placeholder: "Ej.: Feria Ambiente 2026, formulario web…" })}
        {s("estado", "Estado", ESTADOS)}
        {s("calidad", "Calidad del prospecto", CALIDADES, "Sin calificar")}
        {s("prioridad", "Prioridad", PRIORIDADES, "Sin prioridad")}
        {t("etiquetas", "Etiquetas", { placeholder: "Separadas por comas: FG, Información enviada" })}
        <div>
          <label className="label" htmlFor="grupo">Grupo</label>
          {grupoFijo ? (
            <><input type="hidden" name="grupo" value={grupoDefecto} /><div className="input bg-surface-2">{grupoDefecto}</div></>
          ) : (
            <select id="grupo" name="grupo" defaultValue={grupoDefecto} className="input">{GRUPOS.map((g) => <option key={g}>{g}</option>)}</select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="responsable">Comercial responsable</label>
          {puedeReasignar ? (
            <select id="responsable" name="responsable" defaultValue={cliente.responsable ?? (asignables.some((a) => a.email === usuario.email) ? usuario.email : "")} className="input">
              <option value="">Sin asignar</option>
              {asignables.map((u) => <option key={u.email} value={u.email}>{u.nombre} ({u.grupo})</option>)}
            </select>
          ) : (
            <><input type="hidden" name="responsable" value={cliente.responsable ?? usuario.email} /><div className="input bg-surface-2">{asignables.find((u) => u.email === (cliente.responsable ?? usuario.email))?.nombre ?? "Tú"}</div></>
          )}
        </div>
        {t("agenteInicial", "Agente inicial")}
      </section>
      <section className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
        {!cliente.id && (
          <>
            <div className="sm:col-span-2">{t("proximaAccion", "Primera acción (se añade a la agenda)", { placeholder: "Ej.: llamar para presentarnos, enviar catálogo…" })}</div>
            {t("fechaProximaAccion", "Fecha", { type: "date" })}
          </>
        )}
        <div className="sm:col-span-3">
          <label className="label" htmlFor="notas">Notas</label>
          <textarea id="notas" name="notas" defaultValue={cliente.notas ?? ""} rows={3} className="input" />
        </div>
      </section>
      <div className="flex justify-end"><button className="btn-primary">{submit}</button></div>
    </form>
  );
}
