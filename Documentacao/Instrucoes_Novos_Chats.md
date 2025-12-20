# Instruções para Novos Chats - Projeto Taskora

## Visão Geral
- **Repositório:** monorepo gerenciado por `pnpm` com pastas principais:
  - `apps/api`: backend Fastify/TypeScript.
  - `apps/web`: frontend Next.js.
  - `packages/config`: configs compartilhadas (ESLint, Prettier, TS).
  - `infra/terraform`: infraestrutura em Terraform.
  - `Documentacao`: documentação do projeto (inclui este arquivo, `chat_novo.md`, `README_dev.md`, etc.).

## Documentação Obrigatória
- Sempre registrar atividades e decisões em `Documentacao/chat_novo.md` (log cronológico).
- Atualizar `Documentacao/README_dev.md` quando comandos, variáveis ou fluxos mudarem.
- Manter este arquivo (`Instrucoes_Novos_Chats.md`) alinhado com o processo atual.
- Não remover histórico existente; adicionar novas entradas cronológicas.

## Modulo de clientes (escopo atual)
- Trabalhamos em modo offline-first: Firestore e o cache directory_clients sao as fontes de verdade, e os conectores descritos em Documentacao/taskora_google_meta.md e Documentacao/GA4_taskora.md apenas alimentam esse cache via scripts/Jobs.
- Campos de integra��es (IDs de Google Ads, Meta Ads, GA4, contas principais) sao preenchidos diretamente no cadastro do cliente; usuarios nao digitam nada vindo das APIs externas e nunca buscamos dados dinamicamente via UI.
- Cards de metricas mostram primeiro os dados locais e, se precisarem de um conector externo, devem exibir status amigavel (ok/degradado/offline) e mensagens baseadas em Documentacao/linguagem_dashboard.md.
- Mudancas de backend ligadas ao modulo de clientes precisam vir acompanhadas da respectiva tela/component no frontend e ser validadas imediatamente (tests pnpm --filter @taskora/api test e pnpm --filter @taskora/web lint|test).
- Toda atualizacao referente ao modulo deve ser registrada em chat_novo.md e, quando envolver integra��es externas, referenciar tambem os guias oficiais citados acima.

- Jobs ativos:
  - `directory-cache-sync` (Cloud Run Job + Scheduler 05:00 UTC) executa `node /workspace/apps/api/dist/scripts/run-directory-cache-sync.js` para manter `directory_clients` atualizado.
  - `metrics-sync` (Scheduler 05:30 UTC) executa `node /workspace/apps/api/dist/scripts/run-metrics-sync.js` e grava os ranges `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `LAST_MONTH` em `client_metrics_cache`.

## Roadmap imediato (Clientes, UX e Times)
- **GA4 properties**: rodar periodicamente `pnpm --filter @taskora/api ga4:properties:sync` (idealmente via Cloud Run Job descrito em `seed_scheduler.md`). A ultima auditoria (2025-11-17) ainda aponta pendencias para Nanda Cora (doc ausente) e contas Lele da Cuca / Flavio Cora / Karyne Magalhaes (sem property retornada pelo agente). Revisar cadastro desses clientes e a publicacao das properties antes de executar o sync em modo real.
- **Fluxo de horas e metricas amigaveis**: consolidar o registro automatico de horas na TaskList (modal ja criado) e alinhar os cards de Google/Meta/GA4 a saida do MCP summary (sem campos inexistentes, textos seguindo `Documentacao/linguagem_dashboard.md`).
- **Modulo de times**: proximo passo logico para destravar owners de projetos/tarefas. Precisamos mapear usuarios/equipes em Firestore (`users`/`teams`), expor controles no painel (atribuir owner, filtrar por time, medir produtividade) e integrar esse contexto com projetos, tarefas e banco de horas.

## Comandos Essenciais
```bash
pnpm install
pnpm --filter @taskora/api dev        # API local (porta 8080)
pnpm --filter @taskora/web dev        # Frontend local (porta 3000)
pnpm --filter @taskora/api lint|test|format
pnpm --filter @taskora/web lint|test|format
```
- Testes rodam com Vitest; lint usa `@taskora/eslint-config`.

## Convenções de Desenvolvimento
- Usar TypeScript estrito e validações com Zod.
- Respeitar import order definido no ESLint (alfabético com grupos).
- Commits seguem padrão convencional (commitlint configurado).
- Hooks Husky ainda não habilitados; avaliar antes de adicionar.

## Autenticação & RBAC
- A API utiliza Firebase Auth para validar tokens. Se `FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY` estiverem definidos, o SDK Admin é usado.
- Em desenvolvimento/testes, `AUTH_ALLOW_INSECURE=true` habilita tokens fake (JSON em base64) para não depender de credenciais reais.
- Endpoint protegido disponível: `GET /auth/me` (retorna `uid`, `email`, `orgId`, `roles`).
- Toda rota protegida deve usar `preHandler: app.authenticate` e operar com `request.user`.
- Para RBAC, use `preHandler: app.requireRoles([...])`; para isolar tenant, utilize `app.requireOrg()` que injeta `request.orgId`.
- Tokens de desenvolvimento devem conter campos coerentes (ex.: `{ "uid": "dev", "email": "...", "orgId": "org-001", "roles": ["gestor"] }`).

## Infraestrutura
- Terraform em `infra/terraform/`; backend GCS (`taskora-terraform-state`) deve existir antes de `terraform init`.
- Variáveis por ambiente em `infra/terraform/environments/*.tfvars`.

## Fluxo de Trabalho Recomendado
1. Checar `Documentacao/chat_novo.md` para último estado.
2. Atualizar o log antes e depois de alterações significativas.
3. Executar lint e testes para os pacotes modificados.
4. Documentar novas rotas ou UI no log e, se necessário, criar seções adicionais.
5. Se adicionar dependências ou scripts, refletir em `README_dev.md`.

## Contatos/PO
- PO acompanha via documentação e solicitações no chat; mantenha comunicação clara sobre progresso, riscos e bloqueios.
