# Guia de Desenvolvimento - Taskora

## Requisitos
- Node.js LTS (>= 20)
- `pnpm` (instalado globalmente)
- Conta GCP/Firebase configurada (`dacora---tarefas`)
## Preparação
```bash
pnpm install
```

### Variáveis de ambiente
- `apps/web/.env.development.local`:  
  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
    NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-api-key>
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dacora---tarefas.firebaseapp.com
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=dacora---tarefas
  NEXT_PUBLIC_FIREBASE_APP_ID=1:406318974539:web:d842997c1b064c0ba56fce
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=dacora---tarefas.firebasestorage.app
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=406318974539
  NEXT_PUBLIC_FIREBASE_VAPID_KEY=<chave VAPID do Firebase>
  NEXT_PUBLIC_ALLOW_DEV_TOKEN=true
  ```
- `apps/web/.env.production`: seguem os mesmos campos, mas com `NEXT_PUBLIC_API_BASE_URL=https://taskora-api-fq54fov6wq-rj.a.run.app` e `NEXT_PUBLIC_ALLOW_DEV_TOKEN=false`.
- `apps/web/.env`: arquivo usado no build/publicação (mesmos valores do `.env.production`). O Firebase Hosting lê esse arquivo; use o `.env.development.local` apenas para desenvolvimento local.
- `apps/api` utiliza as variáveis (opcionais em dev):
  ```env
  PORT=8080
  # Para uso com Firebase real
  FIREBASE_PROJECT_ID=...
  FIREBASE_CLIENT_EMAIL=...
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  # Para desenvolvimento sem credenciais (default true em dev/test)
  AUTH_ALLOW_INSECURE=true
  EXTERNAL_API_BASE_URL=https://api-wviue4ksza-uc.a.run.app/api
  EXTERNAL_API_BEARER=<token dedicado ao Taskora>
  EXTERNAL_MCP_BASE_URL=https://saldos-mcp-817801200453.us-central1.run.app
  EXTERNAL_MCP_TOKEN=<token MCP do Taskora>
  EXTERNAL_GA4_BASE_URL=https://agente-ga4-api-860407662159.us-central1.run.app
  EXTERNAL_GA4_TOKEN=<token x-internal-taskora do GA4>
  VERTEX_API_BASE_URL=https://us-central1-aiplatform.googleapis.com/v1
  VERTEX_PROJECT_ID=dacora---tarefas
  VERTEX_LOCATION=us-central1
  VERTEX_MODEL=gemini-1.5-flash
  VERTEX_API_KEY=<api-key opcional para fallback>
  ```
  - O agente Gemini usa autenticação OAuth das APIs do Google. Em produção, o Cloud Run utiliza a service account `taskora-backend@dacora---tarefas.iam.gserviceaccount.com` (garanta que ela tenha acesso ao Vertex). Em desenvolvimento, configure `GOOGLE_APPLICATION_CREDENTIALS` apontando para o JSON da mesma service account antes de chamar `/agent/query`. Se precisar rodar fora do GCP, defina `VERTEX_API_KEY` e aponte `VERTEX_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta` para habilitar o fallback por API key.
- `apps/pinterest-mcp/.env` (novo serviço MCP dedicado ao Pinterest):
  ```env
  PORT=8080
  LOG_LEVEL=info
  MCP_INTERNAL_TOKEN=taskora-pinterest-token-dev
  FIREBASE_PROJECT_ID=dacora---tarefas
  FIREBASE_CLIENT_EMAIL=taskora-backend@dacora---tarefas.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  DEFAULT_ORG_ID=org-taskora
  PINTEREST_API_BASE_URL=https://api.pinterest.com/v5
  PINTEREST_DEFAULT_METRICS=SPEND,IMPRESSIONS,CLICKS,TOTAL_CONVERSIONS
  ```

## Comandos Principais
| Objetivo | Comando |
| --- | --- |
| Rodar API em dev | `pnpm --filter @taskora/api dev` |
| Rodar Front em dev | `pnpm --filter @taskora/web dev` |
| Rodar Pinterest MCP em dev | `pnpm --filter @taskora/pinterest-mcp dev` |
| Testes API | `pnpm --filter @taskora/api test` |
| Testes Front | `pnpm --filter @taskora/web test` |
| Testes Pinterest MCP | `pnpm --filter @taskora/pinterest-mcp test` |
| Lint API | `pnpm --filter @taskora/api lint` |
| Lint Front | `pnpm --filter @taskora/web lint` |
| Lint Pinterest MCP | `pnpm --filter @taskora/pinterest-mcp lint` |
| Format API | `pnpm --filter @taskora/api format` |
| Format Front | `pnpm --filter @taskora/web format` |
| Check integrações externas | `pnpm --filter @taskora/api integrations:check` |
| Check global | `pnpm integrations:check` |
| Sincronizar diretório interno de clientes | `pnpm --filter @taskora/api directory:cache:sync` |
| Sincronizar cache de métricas dos clientes | `pnpm --filter @taskora/api metrics:sync` |
| Importar clientes do diretório externo | `pnpm --filter @taskora/api seed:directory` |
| Sincronizar usuários (Firebase Auth + Firestore/users) | `pnpm --filter @taskora/api seed:users` |
| Apagar collections do Firestore (usar com cuidado) | `pnpm --filter @taskora/api wipe:firestore -- clients settings ...` |

## Modulo de clientes (offline-first)
- O cadastro de clientes e abastecido exclusivamente pelo nosso banco (Firestore). Scripts/Jobs (pnpm --filter @taskora/api directory:cache:sync ou seed:directory) apenas alimentam o cache directory_clients; a UI nunca depende de chamadas em tempo real aos conectores.
- IDs e credenciais (Google Ads, Meta Ads, GA4) sao persistidos no documento do cliente e nao devem ser solicitados novamente ao usuario. Integracoes externas descritas em Documentacao/taskora_google_meta.md e Documentacao/GA4_taskora.md servem apenas como fontes de dados auxiliares.
- Cards de metricas e status precisam priorizar os dados locais e exibir o estado do servico externo (ok/degradado/offline) com mensagens amigaveis quando houver falha. Use Documentacao/linguagem_dashboard.md como referencia para as copias.
- Todo ajuste no backend referente ao modulo de clientes deve vir acompanhado do componente/tela equivalente no frontend e passar pelos testes pnpm --filter @taskora/api test e pnpm --filter @taskora/web lint|test antes de ser registrado no log.
- O agendamento do cache deve seguir o guia Documentacao/seed_scheduler.md; registre no chat_novo.md qualquer execucao manual ou job criado.

### Jobs e automa��es
- `directory-cache-sync`: Cloud Run Job (imagem `gcr.io/dacora---tarefas/taskora-api:latest`) que executa `node /workspace/apps/api/dist/scripts/run-directory-cache-sync.js`. Cloud Scheduler `projects/dacora---tarefas/locations/southamerica-east1/jobs/directory-cache-sync` roda diariamente �s 05:00 UTC.
- `metrics-sync`: Cloud Run Job que executa `node /workspace/apps/api/dist/scripts/run-metrics-sync.js`, alimentando o cache de `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH` e `LAST_MONTH`. Scheduler `projects/dacora---tarefas/locations/southamerica-east1/jobs/metrics-sync` roda �s 05:30 UTC.
- `ga4-properties-sync`: Cloud Run Job que executa `node /workspace/apps/api/dist/scripts/run-ga4-properties-sync.js` para preencher `ga4PropertyIds` direto do agente GA4 (`GET /ga4/properties`). Agende apos o directory-sync ou rode manualmente quando novos acessos forem liberados.
- Logs e execu����es: `gcloud run jobs executions list --job=<nome> --region=southamerica-east1` e `gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="<nome>"' --limit 100`.

## Utilitario apiFetch (Frontend)
- Use `apiFetch("/rota", { token, method, body, query })` para falar com a API do Taskora. `body` em objetos JS e `query` em objetos simples sao serializados automaticamente.
- Cabecalhos `Authorization` sao aplicados quando `token` for informado; por padrao o helper desabilita cache (`cache: "no-store"`).
- Para enviar formulários (`FormData`/`URLSearchParams`), basta passar o objeto em `body`; o helper remove o `Content-Type` para que o browser defina corretamente.

## Convenções
- Usar `@taskora/eslint-config` e `@taskora/prettier-config` em todos os pacotes.
- Commits seguirão `commitlint` (config convencional). Hooks Husky serão ativados assim que repo Git for inicializado.
- Para textos no dashboard, seguir o guia `Documentacao/linguagem_dashboard.md` antes de introduzir novos termos ou mensagens.

### Testando Autenticação no Front
- Login padrão: use o botão **Entrar com Google**. O Firebase Auth do projeto `dacora---tarefas` já está configurado e os usuários foram provisionados via `pnpm --filter @taskora/api seed:users`.
- Para desenvolvimento offline, mantenha `NEXT_PUBLIC_ALLOW_DEV_TOKEN=true` e utilize o formulário de token manual (base64) somente quando o login do Google não estiver disponível.
- O script `pnpm --filter @taskora/api seed:users` lê `apps/api/seeds/users.json`, cria/atualiza os usuários no Firebase Auth, define as `customClaims` (`orgId`, `roles`) e sincroniza o documento correspondente na coleção `users`.
- A API exige tokens reais do Firebase quando `AUTH_ALLOW_INSECURE=false`. Deixe essa flag ativada apenas em ambientes locais/teste.
- Rotas protegidas na API exigem:
  - `app.authenticate` para validar token.
  - `app.requireRoles([...])` para RBAC.
  - `app.requireOrg()` para assegurar `orgId` presente (salvo exceções).

### Endpoints Atuais
- `GET /health` - status do serviço.
- `GET /auth/me` - retorna usuário autenticado.
- `POST /agent/query` - expõe o agente Vertex. Requer auth + org e aceita `{ prompt, tools[] }` para montar contexto e responder com os conectores internos/MCP/GA4.
- `/clients`
  - `GET /clients` – requer roles `gestor | analista | suporte`; filtra por tenant automaticamente.
  - `POST /clients` – apenas `gestor`.
  - `PUT /clients/:id` – `gestor` ou `analista`.
  - `DELETE /clients/:id` – soft delete (status `archived`), apenas `gestor`.
- `/clients/:id/integrations`
  - `GET` – retorna integrações armazenadas (gestor/analista/suporte).
  - `POST /link-directory` – gestores vinculam um cliente ao `/directory/clients/:id` externo.
- `/integrations/directory/clients` – proxy autenticado do endpoint externo `/directory/clients` (usa os tokens EXTERNAL_*); disponível para `gestor/analista/suporte`.
- `/projects`
  - `GET /projects` – lista projetos (filtros `status`, `clientId`).
  - `POST /projects` – cria projeto vinculado a um cliente (gestor).
  - `PUT /projects/:id` – atualiza (gestor/analista).
  - `DELETE /projects/:id` – arquiva (gestor).
- `/projects/:projectId/tasks`
  - `GET /projects/:projectId/tasks` - lista tarefas do projeto por status/assignee (`gestor | analista | suporte`).
  - `POST /projects/:projectId/tasks` - cria tarefa com checklist/responsaveis/integracoes (`gestor | analista`).
  - `PUT /projects/:projectId/tasks/:taskId` - atualiza status, checklist, integracoes ou responsaveis (`gestor | analista`).
  - `DELETE /projects/:projectId/tasks/:taskId` - arquiva tarefa e registra log (`gestor`).
- `/time-entries`
  - `GET /time-entries` - lista lancamentos por projeto/tarefa/usuario (`gestor | analista | suporte`).
  - `POST /time-entries` - registra horas manuais vinculadas a projeto/tarefa (`gestor | analista`).
  - `PUT /time-entries/:id` - ajusta minutos/data/notas (`gestor | analista`).
  - `DELETE /time-entries/:id` - remove lancamento (`gestor`).

- `/metrics/summary`
  - Agrega clientes ativos/arquivados e projetos ativos/pausados para preencher o dashboard.
  - Disponivel para `gestor/analista/suporte` e respeita o `orgId` do token autenticado.
- `/reports/hours`
  - `GET /reports/hours?startDate&endDate` consolida minutos no intervalo, com filtros opcionais de `projectId`/`userId`.
  - Usado pelos cards do dashboard para exibir horas do dia; liberado para `gestor/analista/suporte`.
- `/clients/:id/timeline`
  - `GET` retorna os eventos do cliente (gestor/analista/suporte) com filtros (`limit`, `eventType`, `before`) para paginação e segmentação por tipo; `POST` (gestor/analista) adiciona notas/integrações com título/descrição/tags.
  - Repository tem fallback in-memory e escreve em `client_timeline` no Firestore quando credenciais estiverem configuradas.
  - Mudanças de status dos conectores (Google/Meta/GA4) passam a registrar eventos automaticamente.
- `/clients/:id/metrics/summary`
  - `GET` retorna apenas o cache offline (`client_metrics_cache`). Use este endpoint para exibir as métricas no dashboard sem tocar os conectores.
- `/clients/:id/metrics/refresh`
  - `POST` força a sincronização de um cliente específico (Google/Meta/GA4) reaproveitando o mesmo fluxo do job `metrics:sync`. Útil para operadores que clicam em “Sincronizar agora” na ficha do cliente.
  - Ambos dependem das variáveis `EXTERNAL_API_*`, `EXTERNAL_MCP_*`, `EXTERNAL_GA4_*` e dos IDs vinculados ao cliente (`googleCustomerIds`, `metaAccountIds`, `ga4PropertyIds`, `pinterestAccountIds`).
- `/metrics/integrations/status`
  - `GET` retorna o status consolidado dos conectores por plataforma (connected/missing/pending/error) e lista de alertas recentes (clientes com erro ou pendência).
  - Atualizado automaticamente sempre que `/clients/:id/metrics/summary` é consultado.
- `/maintenance/integrations/directory/sync`
  - `POST` (roles `gestor`) executa o mesmo fluxo do script `seed:directory`, sincronizando os clientes do diretório externo para o tenant autenticado (`orgId`). Aceita `batchSize` e `maxEntries` no corpo.

## Próximos Itens
- Infra: preparar `infra/terraform` com provisionamento do projeto `dacora---tarefas`.
- CI/CD: GitHub Actions + Cloud Build (deploy para Cloud Run/Hosting).
- Observabilidade: conectar API ao Cloud Logging/Monitoring.

## Checklist rápido das integrações externas
- Rode `pnpm --filter @taskora/api integrations:check` para validar rapidamente os conectores antes de compartilhar tokens. O script marca cada verificação como `ok`, `skipped` (quando a env não está configurada) ou `failed`.
- Pré-requisitos:
  - Defina `EXTERNAL_API_BEARER`, `EXTERNAL_MCP_TOKEN` e `EXTERNAL_GA4_TOKEN` no ambiente. Checks sem token são ignorados para evitar falsos negativos.
  - Para testar GA4 com um `runReport`, informe `GA4_CHECK_PROPERTY_ID` (opcionais `GA4_CHECK_START_DATE`/`GA4_CHECK_END_DATE`). Sem o ID a etapa é pulada.
- Saída: tabela no terminal. Qualquer `failed` encerra o comando com código `1`, permitindo uso em pipelines ou em um preflight antes do deploy.
### Configurando Firebase/Firestore
1. Obtenha o JSON da service account `taskora-backend@dacora---tarefas.iam.gserviceaccount.com` (Secret Manager do projeto `dacora---tarefas`) e salve localmente:
   ```bash
   gcloud secrets versions access latest \
     --project=dacora---tarefas \
     --secret=taskora-firebase-admin \
     > service-account.json
   ```
2. Preencha `apps/api/.env` (copie de `apps/api/.env.example`) com `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`. Se preferir, defina `FIREBASE_CREDENTIALS_PATH=./service-account.json` e deixe o código carregar o arquivo automaticamente.
3. Reinicie `pnpm --filter @taskora/api dev`. Quando as variáveis estiverem presentes, todos os repositórios (clientes, projetos, tarefas, timeline, horas) passam a usar o Firestore real automaticamente.
4. Em ambientes Cloud Run/Functions, configure os mesmos valores via Secret Manager (`--set-secrets`) em vez de inserir a chave inline no YAML.

### Importando clientes do diretório externo
- Com o Firestore configurado e os tokens EXTERNAL_* ativos, execute `pnpm --filter @taskora/api seed:directory` para sincronizar os clientes vindos da API externa.
- Variáveis úteis:
  - `SEED_ORG_ID` (padrão `org-dev`)
  - `SEED_ACTOR_ID` (padrão `seed-script`)
  - `SEED_DIRECTORY_BATCH_SIZE` (`50`) e `SEED_DIRECTORY_MAX_BATCHES` (`20`) para controlar paginação.
- O script cria/atualiza clientes e preenche `integrations.directoryId`, `googleCustomerIds` e `metaAccountIds` automaticamente. Rode novamente quando houver novos clientes no diretório.
- Para agendar a sincronização (Cloud Scheduler ou Cloud Run Job), consulte `Documentacao/seed_scheduler.md`.

### Seed de usuários (Firebase Auth)
- Edite `apps/api/seeds/users.json` com `displayName`, `email`, `orgId`, `roles` e, opcionalmente, `disabled`.
- Execute `pnpm --filter @taskora/api seed:users` com `FIREBASE_CREDENTIALS_PATH` (ou `FIREBASE_CREDENTIALS_JSON`) apontando para a service account `taskora-backend@dacora---tarefas.iam.gserviceaccount.com`.
- O script garante que o usuário exista no Firebase Auth, aplica `customClaims` (`orgId`, `roles`) e sincroniza a coleção `users` do Firestore (campos `displayName`, `email`, `roles`, `disabled`, `updatedAt`).
- Reexecute o comando sempre que precisar ajustar papéis ou adicionar pessoas ao Taskora.

### Deploy do dashboard (Firebase Hosting)
- O site Next.js está publicado em `https://taskora-dashboard.web.app` usando o suporte a frameworks do Firebase Hosting (SSR via Cloud Functions).
- Variáveis necessárias:
  - `NEXT_PUBLIC_API_BASE_URL=https://taskora-api-fq54fov6wq-rj.a.run.app`
- Comandos:
  ```bash
  firebase experiments:enable webframeworks     # já habilitado no projeto local
  firebase deploy --project dacora---tarefas --only hosting:dashboard
  ```
- O deploy gera a função `ssrtaskoradashboard` (Node.js 20) em `us-central1`. Qualquer ajuste no dashboard exige novo `firebase deploy --only hosting:dashboard`.
- Firestore indexes (`firestore.indexes.json`): descreve todas as combinações usadas pelos repositórios (`clients`, `projects`, `time_entries`). Para garantir que o ambiente cloud esteja com os índices corretos, rode `firebase deploy --only "firestore:indexes"` ou, caso o Firebase CLI esteja deslogado, execute via gcloud:
  ```bash
  gcloud alpha firestore indexes composite create \
    --project=dacora---tarefas \
    --collection-group=time_entries \
    --field-config='field-path=orgId,order=ascending' \
    --field-config='field-path=date,order=descending' \
    --field-config='field-path=createdAt,order=descending'
  ```
  (repita para cada combinação listada no JSON quando necessário).
### Sincronizando properties GA4
- `pnpm --filter @taskora/api ga4:properties:sync`: consulta o endpoint `/ga4/properties` do agente dedicado, encontra o cliente correspondente (nome/alias) e atualiza `ga4PropertyIds` e `integrations.ga4PropertyIds` no Firestore. Utilize quando um novo acesso for liberado no agente ou apos atualizar a lista de contas.

### Multi-tenant (fase atual)
- Documentos: `Documentacao/Multitenant/multi_tenant_overview.md` e `Documentacao/Multitenant/prompt_codex_multi_tenant_fase_1_e_2.md`.
- Backend valida membership `(orgId,userId)` e aceita `X-Org-Id` com fallback compatível para `Dacora` durante a transição. Rota `GET /organizations` lista as orgs do usuário.
- Front usa `OrgProvider` + `apiFetch` para enviar `X-Org-Id`; seletor de organização na sidebar (oculto quando o usuário só tiver uma org). `activeOrgId` cacheado (localStorage e opcional em `users/{uid}`).
- OrgProvider nao limpa `taskora_active_org` no bootstrap de auth; aplica o org salvo apenas se existir na lista retornada por `/organizations`.
- Script de migração inicial: `pnpm --filter @taskora/api ts-node src/scripts/add-org-id.ts` (define `SEED_ORG_ID=Dacora` ou outro). Atualiza documentos sem `orgId` nas coleções principais.
- Fase 3 pendente: migrar todos os dados legados, criar índices com `orgId` e endurecer regras de segurança removendo o fallback.


### Multi-tenant (fase atual)
- Documentos: `Documentacao/Multitenant/multi_tenant_overview.md` e `Documentacao/Multitenant/prompt_codex_multi_tenant_fase_1_e_2.md`.
- Backend valida membership `(orgId,userId)` e aceita `X-Org-Id` com fallback compat?vel para `Dacora` durante a transi??o. Rota `GET /organizations` lista as orgs do usu?rio.
- Front usa `OrgProvider` + `apiFetch` para enviar `X-Org-Id`; seletor de organiza??o na sidebar (oculto quando o usu?rio s? tiver uma org). `activeOrgId` cacheado (localStorage e opcional em `users/{uid}`).
- OrgProvider nao limpa `taskora_active_org` no bootstrap de auth; aplica o org salvo apenas se existir na lista retornada por `/organizations`.
- Fase 3 pendente: migrar dados legados com `orgId=Dacora`, criar ?ndices com `orgId` e endurecer regras de seguran?a removendo fallback.

### Multi-tenant (org migration ops)
- Map de clientes: edite `Documentacao/Multitenant/org_client_map.json` (campo `org` com D/A/N) e execute `pnpm --filter @taskora/api exec tsx scripts/reassign-clients-orgs.ts --apply`.
- Membership de orgs: edite `Documentacao/Multitenant/org_members_map.json` (emails + D/A/N) e execute `pnpm --filter @taskora/api exec tsx scripts/sync-org-members.ts --apply`.

### Admin allowlist (foco em configurações e time)
- Allowlist fixa de admin: `flacora@gmail.com` e `contato@nandacora.com.br`. Helper `isAdminUser` + guard `requireAdmin` (backend) já disponíveis.
- Endpoints protegidos por admin: configurações de cliente (integrações/IDs, link-directory, Pinterest) e gestão de membros (`/team/members` create/update/delete). Demais rotas operacionais continuam só com `requireOrg` + roles usuais.
- `/auth/me` expõe `isAdmin` para o front; use para ocultar aba Configurações no Cliente 360 e bloquear ações de membros para não-admin.

### Validação via prévia (sem impactar produção)
- Sempre que possível, publicar prévia de Hosting (channel deploy) e compartilhar a URL para validação antes do deploy final do dashboard.
- Objetivo: testar mudanças de multi-tenant/admin sem afetar usuários em produção; ao aprovar, promover ou executar deploy normal.

## Versionamento (repo p�blico) e sigilo
- Este repo � p�blico. Nunca commit tokens/chaves em docs ou c�digo. Use Secret Manager e vari�veis .env locais.
- Os arquivos sens�veis de integra��es (apis_e_mcp, taskora_google_meta, GA4_taskora, pinterest_mcp_plan, tutorial_acesso_apis_mcp, seed_scheduler) est�o no .gitignore para evitar vazamento. Mantenha-os fora do Git ou s� com placeholders.
- Antes de push, revise docs novos para n�o expor credenciais. Tokens reais devem ficar apenas no Secret Manager (Cloud Run via --set-secrets).


## Instagram Insights (preview)
- Nova aba "Instagram Insights" no Cliente 360 (labels em ingles para revisao da Meta).
- Escopos mostrados no modal: instagram_business_basic e instagram_basic. Login permanece em modo preview ate receber App ID e redirect do backend.
- A aba exibe placeholders ate os endpoints de Instagram ficarem disponiveis no projeto consolidado.
- Redirect URI: https://instagram-integration-770338558500.us-central1.run.app/auth/instagram/callback (cadastrar na Meta).
- Env sugerida para o front: NEXT_PUBLIC_INSTAGRAM_AUTH_BASE_URL=https://instagram-integration-770338558500.us-central1.run.app e NEXT_PUBLIC_IG_APP_ID=1181517340574625 (App ID nao e segredo).

