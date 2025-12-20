import type { Metadata } from "next";
import { Red_Hat_Display } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { AppShell } from "../components/layout/AppShell";
import { OrgProvider } from "../components/org/OrgProvider";

const redHat = Red_Hat_Display({
  subsets: ["latin"],
  variable: "--font-red-hat",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Dácora Console Operacional",
  description: "Visão consolidada da operação Dácora com dados de clientes, tarefas e integrações."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={redHat.variable}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="font-sans bg-offWhite text-deepGreen min-h-screen">
        <AuthProvider>
          <OrgProvider>
            <AppShell>{children}</AppShell>
          </OrgProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
