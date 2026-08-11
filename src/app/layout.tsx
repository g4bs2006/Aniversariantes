import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// O app roda embutido na Helena/wts.chat — a tipografia precisa se
// confundir com a do host (sans funcional, sem serifa), não ter identidade
// própria (ver refs/ e o plano do redesign "alinhar ao chrome do host").
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aniversariantes",
  description: "Mensagens automáticas de aniversário para clínicas odontológicas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
