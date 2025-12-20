'use client';

import { ClientForm } from "./ClientForm";
import type { ClientFormProps } from "./ClientForm";

type ClientFormModalProps = ClientFormProps & {
  isOpen: boolean;
  onClose: () => void;
};

export function ClientFormModal({
  isOpen,
  onClose,
  ...formProps
}: ClientFormModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-3xl bg-offWhite shadow-2xl shadow-black/40">
        <button
          type="button"
          aria-label="Fechar formulário de clientes"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-deepGreen/20 bg-white/80 px-3 py-1 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/50 hover:bg-white"
        >
          Fechar
        </button>
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <ClientForm {...formProps} />
        </div>
      </div>
    </div>
  );
}
