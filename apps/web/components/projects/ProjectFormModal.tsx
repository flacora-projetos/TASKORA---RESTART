'use client';

import type { ProjectFormProps } from "./ProjectForm";
import { ProjectForm } from "./ProjectForm";

type ProjectFormModalProps = ProjectFormProps & {
  isOpen: boolean;
};

export function ProjectFormModal({ isOpen, ...formProps }: ProjectFormModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-offWhite shadow-2xl shadow-black/40">
        <ProjectForm {...formProps} />
      </div>
    </div>
  );
}
