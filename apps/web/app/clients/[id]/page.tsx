import type { Metadata } from "next";

import { ClientDetailsPage } from "../../../components/clients/ClientDetailsPage";

type Props = {
  params: {
    id: string;
  };
};

export const metadata: Metadata = {
  title: "Taskora · Detalhes do Cliente"
};

export default function ClientDetailsRoute({ params }: Props): JSX.Element {
  return <ClientDetailsPage clientId={params.id} />;
}
