import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";

const si = (v?: string) => ["true", "1", "si", "sí", "yes"].includes((v ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase());
export const devLogin = si(process.env.AUTH_DEV_LOGIN);
export const devPassword = !!process.env.AUTH_DEV_PASSWORD?.trim();

/**
 * Auth.js necesita el «issuer» exacto del tenant (con su id, no el dominio):
 * https://login.microsoftonline.com/<id-del-tenant>/v2.0
 * Se toma de AUTH_MICROSOFT_ENTRA_ID_ISSUER o se averigua a partir de
 * AUTH_MICROSOFT_ENTRA_ID_TENANT_ID (id o dominio, p. ej. natuaromatic.com).
 */
let issuerCache: Promise<string | undefined> | undefined;
function entraIssuer(): Promise<string | undefined> {
  const fijo = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (fijo) return Promise.resolve(fijo);
  const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim().replace(/^["']|["']$/g, "");
  if (!tenant) return Promise.resolve(undefined);
  if (/^[0-9a-f-]{36}$/i.test(tenant)) return Promise.resolve(`https://login.microsoftonline.com/${tenant}/v2.0`);
  issuerCache ??= fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0/.well-known/openid-configuration`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`tenant ${tenant}: HTTP ${r.status}`))))
    .then((j: { issuer: string }) => j.issuer)
    .catch((e) => {
      issuerCache = undefined;
      console.error("[auth] No se pudo averiguar el tenant de Microsoft:", e);
      return undefined;
    });
  return issuerCache;
}

async function buildProviders(): Promise<Provider[]> {
const providers: Provider[] = [];
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  // Lee AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET del entorno; el issuer se resuelve arriba.
  providers.push(MicrosoftEntraID({ issuer: await entraIssuer() }));
}
if (devLogin) {
  // SOLO DESARROLLO: entrar como cualquier usuario de la hoja Usuarios sin contraseña.
  providers.push(
    Credentials({
      id: "dev",
      name: "Modo desarrollo",
      credentials: { email: { label: "Email" }, password: { label: "Clave", type: "password" } },
      authorize: async (c) => {
        // Publicado (Vercel u otro): exige la clave compartida AUTH_DEV_PASSWORD, como en NPD.
        const clave = process.env.AUTH_DEV_PASSWORD?.trim();
        if (clave ? c?.password !== clave : process.env.NODE_ENV === "production" && process.env.VERCEL) return null;
        const email = String(c?.email ?? "").toLowerCase();
        return email ? { id: email, email, name: email } : null;
      },
    }),
  );
}
return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  providers: await buildProviders(),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    // El permiso real se comprueba en cada petición contra la hoja Usuarios (lib/session.ts),
    // así que un cambio de rol o una baja tienen efecto inmediato.
    jwt({ token, profile }) {
      const p = profile as { preferred_username?: string; email?: string } | undefined;
      if (p) token.email = (p.email ?? p.preferred_username ?? token.email ?? "").toLowerCase();
      return token;
    },
  },
}));
