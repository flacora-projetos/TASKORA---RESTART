import type { Metadata } from "next";

import { CalendarShell } from "../../components/calendar/CalendarShell";

export const metadata: Metadata = {
  title: "Calendario | Taskora",
  description: "Visualize as tarefas por semana e organize os prazos do Taskora em um unico lugar."
};

export default function CalendarPage(): JSX.Element {
  return <CalendarShell />;
}
