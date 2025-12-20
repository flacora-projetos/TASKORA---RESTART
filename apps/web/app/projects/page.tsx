import { Suspense } from "react";

import { ProjectsPage } from "../../components/projects/ProjectsPage";

export default function ProjectsRoute(): JSX.Element {
  return (
    <Suspense fallback={<p className="text-sm text-deepGreen/70">Carregando projetos...</p>}>
      <ProjectsPage />
    </Suspense>
  );
}
