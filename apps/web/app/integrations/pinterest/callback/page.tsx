'use client';

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../../components/auth/AuthProvider";
import { apiFetch, ApiError } from "../../../../lib/api";

type CallbackResponse = {
  clientId?: string | null;
};

type StatusState =
  | { status: "processing"; message: string; clientId?: string | null }
  | { status: "success"; message: string; clientId?: string | null }
  | { status: "error"; message: string; clientId?: string | null };

function PinterestCallbackContent(): JSX.Element {
  const searchParams = useSearchParams();
  const { token, status: authStatus } = useAuth();
  const [state, setState] = useState<StatusState>({
    status: "processing",
    message: "Confirmando autorização do Pinterest..."
  });
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) {
      return;
    }
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");
    const stateParam = searchParams.get("state");

    if (oauthError) {
      submittedRef.current = true;
      setState({
        status: "error",
        message: oauthErrorDescription ?? `Pinterest retornou erro: ${oauthError}`,
        clientId: null
      });
      return;
    }

    if (!code || !stateParam) {
      setState({
        status: "error",
        message: "Não recebemos o código de autorização do Pinterest.",
        clientId: null
      });
      return;
    }

    if (!token) {
      if (authStatus === "authenticated") {
        submittedRef.current = true;
        setState({
          status: "error",
          message: "Token de sessão inválido. Faça login novamente e repita a autorização.",
          clientId: null
        });
      }
      return;
    }

    submittedRef.current = true;
    const currentRedirectUri = `${window.location.origin}/integrations/pinterest/callback`;
    setState({ status: "processing", message: "Salvando autorização no Taskora..." });

    apiFetch<CallbackResponse>(`/clients/integrations/pinterest/callback`, {
      token,
      method: "POST",
      body: {
        code,
        state: stateParam,
        redirectUri: currentRedirectUri
      }
    })
      .then((response) => {
        setState({
          status: "success",
          message: "Pinterest conectado com sucesso. Você pode voltar ao cadastro do cliente.",
          clientId: response.clientId ?? null
        });
      })
      .catch((error) => {
        const message = error instanceof ApiError ? error.message : "Não foi possível concluir a autorização.";
        setState({
          status: "error",
          message,
          clientId: null
        });
      });
  }, [authStatus, searchParams, token]);

  const isProcessing = state.status === "processing";
  const isSuccess = state.status === "success";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offWhite px-4 py-10 text-deepGreen">
      <section className="w-full max-w-xl rounded-3xl border border-deepGreen/10 bg-white/95 p-8 text-center shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Pinterest MCP</p>
        <h1 className="mt-2 text-2xl font-semibold text-deepGreen">
          {isProcessing ? "Conectando Pinterest..." : isSuccess ? "Autorizado" : "Falha na autorização"}
        </h1>
        <p className="mt-3 text-sm text-deepGreen/70">{state.message}</p>

        <div className="mt-6 flex flex-col gap-3">
          {state.clientId ? (
            <Link
              href={`/clients/${state.clientId}`}
              className="inline-flex items-center justify-center rounded-full border border-deepGreen/20 bg-deepGreen px-5 py-2 text-sm font-semibold text-white shadow"
            >
              Voltar para o cliente
            </Link>
          ) : null}
          <Link
            href="/clients"
            className="inline-flex items-center justify-center rounded-full border border-deepGreen/20 px-5 py-2 text-sm font-semibold text-deepGreen hover:bg-deepGreen/5"
          >
            Ir para clientes
          </Link>
        </div>
      </section>
    </main>
  );
}

function LoadingFallback(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offWhite px-4 py-10 text-deepGreen">
      <section className="w-full max-w-xl rounded-3xl border border-deepGreen/10 bg-white/95 p-8 text-center shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Pinterest MCP</p>
        <h1 className="mt-2 text-2xl font-semibold text-deepGreen">Preparando autorização...</h1>
        <p className="mt-3 text-sm text-deepGreen/70">Estamos carregando os parâmetros do Pinterest. Aguarde só um instante.</p>
      </section>
    </main>
  );
}

export default function PinterestCallbackPage(): JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PinterestCallbackContent />
    </Suspense>
  );
}
