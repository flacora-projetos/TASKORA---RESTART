'use client';

import { Loader2, SendHorizontal, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { useAssistantChat } from "../../hooks/useAssistantChat";
import { GeminiIcon } from "../icons/GeminiIcon";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AssistantPanel({ open, onClose }: Props): JSX.Element {
  const { messages, sendMessage, isLoading, errorMessage } = useAssistantChat();
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const submitMessage = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) {
      return;
    }
    void sendMessage(trimmed);
    setInputValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const assistenteHeading = (
    <div className="flex items-center gap-3">
      <GeminiIcon className="size-7" />
      <div>
        <p className="text-sm font-semibold text-terracota">Gemini no Taskora</p>
        <p className="text-xs text-deepGreen/70">
          Diga “Olá” para descobrir como posso ajudar (tarefas, horas, Meta/Google/GA4).
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-offWhite shadow-[-6px_0px_24px_rgba(15,23,42,0.35)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Assistente Gemini"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-deepGreen/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              {assistenteHeading}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-deepGreen/20 p-1 text-deepGreen/70 transition hover:border-deepGreen hover:text-deepGreen"
                aria-label="Fechar assistente"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-deepGreen/80">
              Diga “Olá” e eu conto tudo o que posso fazer: priorizar tarefas, revisar horas, resumir gastos de Meta/Google
              <span className="whitespace-nowrap"> e</span> GA4 e checar integrações.
            </p>
          </div>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.map((message) => {
              const fromAssistant = message.role !== "user";
              return (
                <div key={message.id} className="flex gap-3">
                  <div className="mt-1">
                    {fromAssistant ? (
                      <GeminiIcon className="size-6" />
                    ) : (
                      <div className="flex size-6 items-center justify-center rounded-full bg-terracota/20 text-xs font-semibold text-terracota">
                        Você
                      </div>
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      fromAssistant ? "bg-white text-deepGreen shadow-sm" : "bg-terracota text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              );
            })}
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-deepGreen/60">
                <Loader2 className="size-4 animate-spin" />
                Consultando módulos do Taskora...
              </div>
            ) : null}
          </div>

          <div className="border-t border-deepGreen/10 px-5 py-4">
            {errorMessage ? (
              <p className="mb-2 text-xs font-semibold text-terracota">
                {errorMessage} — tente novamente em alguns segundos.
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl border border-deepGreen/20 bg-white px-4 py-2 shadow-sm focus-within:border-deepGreen focus-within:ring-1 focus-within:ring-deepGreen/40">
                <label htmlFor="assistant-input" className="sr-only">
                  Escreva a mensagem
                </label>
                <textarea
                  id="assistant-input"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex.: Quais tarefas atrasadas preciso priorizar hoje?"
                  className="h-20 w-full resize-none bg-transparent text-sm text-deepGreen outline-none placeholder:text-deepGreen/40"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-terracota px-4 py-3 font-semibold text-white shadow-lg shadow-terracota/30 transition hover:bg-terracota/90 disabled:cursor-not-allowed disabled:bg-terracota/40"
                disabled={isLoading || !inputValue.trim()}
              >
                <SendHorizontal className="size-4" />
                <span className="sr-only">Enviar mensagem</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
