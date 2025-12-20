'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

function TitleContent(): JSX.Element {
  return (
    <>
      <p className="text-sm uppercase tracking-[0.3em] text-offWhite/80">Dácora</p>
      <h1 className="text-2xl font-semibold">Console Operacional</h1>
    </>
  );
}

export function HeaderTitle(): JSX.Element {
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "";

  if (isHome) {
    return (
      <div>
        <TitleContent />
      </div>
    );
  }

  return (
    <Link
      href="/"
      className="flex flex-col transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offWhite"
      aria-label="Voltar para o dashboard inicial"
      title="Voltar para o dashboard inicial"
    >
      <TitleContent />
    </Link>
  );
}
