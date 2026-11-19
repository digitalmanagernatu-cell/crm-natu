import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";

export const devLogin = process.env.AUTH_DEV_LOGIN === "true";

const providers: Provider[] = [];
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID) {
  // Lee AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET / _ISSUER del entorno.
  providers.push(MicrosoftEntraID({}));
}
if (devLogin) {
  // SOLO DESARROLLO: entrar como cualquier usuario de la hoja Usuarios sin contraseña.
  providers.push(
    Credentials({
      id: "dev",
      name: "Modo desarrollo",
      credentials: { email: { label: "Email" } },
      authorize: async (c) => {
        const email = String(c?.email ?? "").toLowerCase();
        return email ? { id: email, email, name: email } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
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
});
