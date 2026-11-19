import type { Metadata } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";

export const metadata: Metadata = { title: "CRM · NATU Laboratories", description: "CRM comercial Export y Gran Consumo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
