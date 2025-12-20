'use client';

import type { ReactNode } from "react";
import { useState } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { SiteFooter } from "./SiteFooter";
import { AssistantPanel } from "../assistant/AssistantPanel";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="min-h-screen bg-offWhite text-deepGreen">
      <div className="relative flex min-h-screen">
        <AppSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenAssistant={() => setAssistantOpen(true)}
        />
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Fechar menu lateral"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          />
        ) : null}
        <div className="flex min-h-screen flex-1 flex-col">
          <AppHeader onToggleSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">{children}</div>
          </main>
          <SiteFooter />
        </div>
        <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      </div>
    </div>
  );
}
