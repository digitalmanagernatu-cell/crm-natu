import { Chat } from "@/components/Chat";
import { PageHeader } from "@/components/ui";
import { requireUsuario } from "@/lib/session";

export default async function Asistente() {
  const u = await requireUsuario();
  return (
    <>
      <PageHeader title="Asistente IA" subtitle="Consulta el CRM en lenguaje natural. Solo ve los clientes a los que tú tienes acceso." />
      <Chat nombre={u.nombre} />
    </>
  );
}
