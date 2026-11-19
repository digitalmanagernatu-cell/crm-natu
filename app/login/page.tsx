import { redirect } from "next/navigation";
import { auth, devLogin, signIn } from "@/auth";
import { Logo } from "@/components/Logo";
import { store } from "@/lib/store";
import { ROL_LABEL } from "@/lib/types";

export default async function Login() {
  if ((await auth())?.user) redirect("/");
  const entra = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const usuarios = devLogin ? (await store.readAll()).usuarios.filter((u) => u.activo) : [];
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">CRM comercial</h1>
        <p className="mt-1 text-sm text-ink-2">Export · Gran Consumo</p>
        {entra && (
          <form className="mt-8" action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: "/" }); }}>
            <button className="btn-primary w-full justify-center py-2.5">Entrar con Microsoft 365</button>
          </form>
        )}
        {devLogin && (
          <form className="mt-8 space-y-2 border-t border-line pt-6" action={async (f: FormData) => { "use server"; await signIn("dev", { email: f.get("email"), redirectTo: "/" }); }}>
            <label className="label">Modo desarrollo · entrar como</label>
            <select name="email" className="input">
              {usuarios.map((u) => <option key={u.email} value={u.email}>{u.nombre} — {ROL_LABEL[u.rol]} ({u.grupo})</option>)}
            </select>
            <button className="btn-ghost w-full justify-center">Entrar</button>
          </form>
        )}
        {!entra && !devLogin && <p className="mt-8 text-sm text-[var(--bad)]">No hay ningún método de acceso configurado. Revisa las variables AUTH_* del .env.</p>}
      </div>
    </main>
  );
}
