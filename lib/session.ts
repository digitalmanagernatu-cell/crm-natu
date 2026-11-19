import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { filtrarDatos } from "./permissions";
import { store } from "./store";
import type { Usuario } from "./types";

const BOOTSTRAP = (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Usuario del CRM (según la hoja Usuarios) o null si no está dado de alta / está inactivo. */
export async function usuarioActual(): Promise<Usuario | null> {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return null;
  const { usuarios } = await store.readAll();
  const u = usuarios.find((x) => x.email === email);
  if (u?.activo) return u;
  if (!u && BOOTSTRAP.includes(email)) {
    return { email, nombre: s?.user?.name ?? email, grupo: "Todos", rol: "admin", activo: true };
  }
  return null;
}

export async function requireUsuario(): Promise<Usuario> {
  const s = await auth();
  if (!s?.user) redirect("/login");
  const u = await usuarioActual();
  if (!u) redirect("/sin-acceso");
  return u;
}

/** Datos ya recortados a lo que el usuario puede ver. */
export async function datosVisibles() {
  const u = await requireUsuario();
  const d = await store.readAll();
  return { usuario: u, datos: filtrarDatos(u, d) };
}
