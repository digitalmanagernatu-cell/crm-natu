import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CRM Natu", description: "CRM comercial Export y Gran Consumo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
