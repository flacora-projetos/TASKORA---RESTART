'use client';

import { HeaderTitle } from "./HeaderTitle";

type Props = {
  onToggleSidebar: () => void;
};

export function AppHeader({ onToggleSidebar }: Props): JSX.Element {
  return (
    <header className="bg-terracota text-offWhite px-4 py-4 shadow-md shadow-terracota/40">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-full border border-offWhite/40 px-3 py-1 text-sm font-semibold text-offWhite hover:bg-offWhite/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offWhite md:hidden"
          >
            Menu
          </button>
          <HeaderTitle />
        </div>
        <span className="italic text-offWhite/80 text-sm">Powered by Taskora</span>
      </div>
    </header>
  );
}
