import type { Cliente, CrmData, Usuario } from "./types";

/** ¿Puede este usuario ver (y por tanto añadir acciones a) este cliente? */
export function puedeVer(u: Usuario, c: Cliente): boolean {
  if (u.rol === "admin") return true;
  if (u.rol === "responsable") return u.grupo === "Todos" || c.grupo === u.grupo;
  return c.responsable === u.email;
}

/** Editar ficha: mismo criterio que ver. */
export const puedeEditar = puedeVer;

/** Reasignar responsable o cambiar de grupo: solo responsables y admin. */
export function puedeReasignar(u: Usuario, c: Cliente): boolean {
  return u.rol !== "comercial" && puedeVer(u, c);
}

export function esAdmin(u: Usuario) {
  return u.rol === "admin";
}

/** Recorta todo el dataset a lo que el usuario puede ver. Úsalo SIEMPRE antes de enviar datos al navegador o a la IA. */
export function filtrarDatos(u: Usuario, d: CrmData): CrmData {
  const clientes = d.clientes.filter((c) => puedeVer(u, c));
  const ids = new Set(clientes.map((c) => c.id));
  return {
    clientes,
    acciones: d.acciones.filter((a) => ids.has(a.clienteId)),
    proyectos: d.proyectos.filter((p) => ids.has(p.clienteId)),
    usuarios: d.usuarios,
  };
}

/** Comerciales a los que este usuario puede asignar clientes. */
export function asignables(u: Usuario, usuarios: Usuario[]): Usuario[] {
  const activos = usuarios.filter((x) => x.activo);
  if (u.rol === "admin") return activos;
  if (u.rol === "responsable") return activos.filter((x) => u.grupo === "Todos" || x.grupo === u.grupo || x.grupo === "Todos");
  return activos.filter((x) => x.email === u.email);
}
