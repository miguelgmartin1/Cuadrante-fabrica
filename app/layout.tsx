import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Planificación de Turnos",
  description: "Gestión de cuadrantes de turnos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased flex flex-col h-screen">
        <Nav />
        <main className="flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
