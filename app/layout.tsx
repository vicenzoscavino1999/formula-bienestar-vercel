import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fórmula del Bienestar",
  description: "Simulador visual de bienestar, memoria interior y armonía presente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
