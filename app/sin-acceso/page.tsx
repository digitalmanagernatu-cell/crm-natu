import { auth, signOut } from "@/auth";

export default async function SinAcceso() {
  const s = await auth();
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card max-w-md p-8">
        <h1 className="text-xl font-semibold">Sin acceso al CRM</h1>
        <p className="mt-2 text-sm text-ink-2">
          La cuenta <b>{s?.user?.email}</b> no está dada de alta (o está inactiva) en la hoja <i>Usuarios</i>. Pide a un administrador que te añada.
        </p>
        <form className="mt-6" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="btn-ghost">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
