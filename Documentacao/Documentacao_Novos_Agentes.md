# Registro Rapido para Novos Chats

- **Documentacao obrigatoria**: leia `Documentacao/chat_novo.md`, `Documentacao/Instrucoes_Novos_Chats.md`, `Documentacao/tutorial_acesso_apis_mcp.md` e `Documentacao/README_dev.md` antes de editar qualquer coisa.
- **Comandos basicos**:
  - Instalar dependencias: `pnpm install`
  - API dev: `pnpm --filter @taskora/api dev`
  - Web dev: `pnpm --filter @taskora/web dev`
  - Testes API/Web: `pnpm --filter @taskora/api test`, `pnpm --filter @taskora/web test`
  - Lint: `pnpm --filter @taskora/api lint`, `pnpm --filter @taskora/web lint`
- **Autenticacao**: login padrao com **Entrar com Google** (Firebase Auth do projeto `dacora---tarefas`). O formulario de token manual so aparece quando `NEXT_PUBLIC_ALLOW_DEV_TOKEN=true` em ambientes locais.
- **Fluxo de documentacao**: registre avancos em `Documentacao/chat_novo.md` ao iniciar e finalizar cada bloco de trabalho, incluindo comandos executados.
- **Modulos entregues**:
  - Clientes/Projetos/Tarefas com RBAC completo.
  - Integracoes de diretorio (Google/Meta) ja configuradas.
  - Lancamentos de horas `/time-entries` + relatorio `/reports/hours`.
  - Dashboard Next.js com cards de autenticacao, metricas, horas do dia, clientes, tarefas e formulario de horas.
  - Rotas `/clients` (lista/CRUD) e `/clients/[id]` (detalhes + integracoes) no front usando as APIs atuais.
- Timeline por cliente (`/clients/:id/timeline`) com notas internas/logs de integracao, exibida em /clients/[id].
- Card de metricas por cliente (`/clients/:id/metrics/summary`) consultando os conectores Google/Meta/GA4 (`EXTERNAL_*`).
- **Proximos passos sugeridos**: evoluir o modulo de clientes (timeline, integracoes Meta/Google/GA4) e relatorios semanais/mensais. Antes de comecar, execute `pnpm --filter @taskora/api test` + `pnpm --filter @taskora/web lint`.

> Sempre confirme com o PO se precisar de tokens definitivos: siga `Documentacao/tutorial_acesso_apis_mcp.md`.

- Dashboard agora mostra cobertura/alertas de integracoes (cards PlatformIntegrationsCard e IntegrationAlertsCard) com links diretos para os clientes.
- Script `pnpm --filter @taskora/api seed:users` mantem usuarios/roles no Firebase Auth + Firestore (`apps/api/seeds/users.json`). Rode sempre que precisar adicionar/remover acessos.
- **Checklist de integracoes**: antes de alterar conectores, configure as variaveis do .env (veja apps/api/.env.example) e rode pnpm integrations:check para garantir que API externa, MCP e GA4 estao respondendo.
  - Checklist integracoes / seed: pnpm integrations:check e pnpm --filter @taskora/api seed:directory (veja README_dev para variaveis necessarias)