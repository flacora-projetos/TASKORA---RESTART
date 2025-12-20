import Link from "next/link";

const CONTACTS = [
  { label: "PO - Fernanda Corá", value: "contato@nandacora.com.br" },
  { label: "Dev - Flávio Corá", value: "flacora@gmail.com" },
  { label: "Equipe Dácora", value: "equipe@nandacora.com" }
];

export function SiteFooter(): JSX.Element {
  return (
    <footer className="bg-deepGreen text-offWhite px-6 py-10 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-offWhite/80">
          <span>Dácora Console Operacional</span>
          <span>•</span>
          <Link
            href="/privacy"
            className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offWhite"
          >
            Política de Privacidade
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          {CONTACTS.map((contact) => (
            <div key={contact.value}>
              <p className="text-offWhite/60">{contact.label}</p>
              <a className="font-semibold hover:underline" href={`mailto:${contact.value}`}>
                {contact.value}
              </a>
            </div>
          ))}
        </div>
        <p className="text-xs text-offWhite/60">
          Operação hospedada em Firebase Hosting + Cloud Run. Logs e integrações seguem as diretrizes registradas em
          Documentacao/chat_novo.md.
        </p>
      </div>
    </footer>
  );
}
