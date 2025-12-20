import type { Metadata } from "next";

const SECTIONS = [
  {
    title: "Dados que coletamos",
    description:
      "Registramos apenas as informações essenciais para a operação (clientes, projetos, integrações e métricas). Tokens e segredos ficam protegidos no Secret Manager; nada sensível é exposto no frontend."
  },
  {
    title: "Como usamos os dados",
    description:
      "Os dados servem para gerar relatórios, acompanhar timelines e ativar integrações Google/Meta/GA4. Não vendemos ou compartilhamos informações com terceiros sem autorização formal do cliente."
  },
  {
    title: "Segurança e conformidade",
    description:
      "Autenticação via Firebase, RBAC por organização e segregação de segredos no Secret Manager. Todo o ambiente roda em infraestrutura GCP (Cloud Run + Firestore) com logs apenas para auditoria interna."
  },
  {
    title: "Seus direitos",
    description:
      "O titular pode solicitar exportação, atualização ou exclusão dos dados a qualquer momento. Basta enviar um e-mail para contato@nandacora.com.br, equipe@nandacora.com ou flacora@gmail.com descrevendo o pedido."
  },
  {
    title: "Contato",
    description:
      "Use os e-mails acima ou o canal dedicado no dashboard para tirar dúvidas adicionais. Respondemos em até 2 dias úteis e atualizamos esta página sempre que houver mudanças relevantes."
  }
];

export const metadata: Metadata = {
  title: "Taskora · Política de Privacidade"
};

export default function PrivacyPage(): JSX.Element {
  return (
    <section className="space-y-6 rounded-2xl border border-deepGreen/15 bg-white/95 p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Transparência</p>
        <h1 className="text-2xl font-semibold text-deepGreen">Política de Privacidade</h1>
        <p className="text-sm text-deepGreen/60">
          Documento atualizado em 11 de novembro de 2025. Esta página descreve como o Taskora trata os dados
          armazenados na plataforma.
        </p>
      </header>
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <article key={section.title} className="rounded-xl border border-deepGreen/10 bg-offWhite/40 p-4">
            <h2 className="text-lg font-semibold text-deepGreen">{section.title}</h2>
            <p className="mt-2 text-sm text-deepGreen/70">{section.description}</p>
          </article>
        ))}
      </div>
      <p className="text-xs text-deepGreen/60">
        Em caso de atualizações relevantes, avisaremos os clientes via e-mail e registraremos a nova data de revisão
        nesta página.
      </p>
    </section>
  );
}
