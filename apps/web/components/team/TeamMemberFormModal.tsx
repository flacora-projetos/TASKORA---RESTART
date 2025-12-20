'use client';

import type { TeamMemberFormProps } from "./TeamMemberForm";
import { TeamMemberForm } from "./TeamMemberForm";

type Props = TeamMemberFormProps & {
  isOpen: boolean;
};

export function TeamMemberFormModal({ isOpen, ...formProps }: Props): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-offWhite shadow-2xl shadow-black/30">
        <TeamMemberForm {...formProps} />
      </div>
    </div>
  );
}
