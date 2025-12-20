# Taskora - Base de Conhecimento (NotebookLM)

> Documento de referencia para treinar/consultar no Google NotebookLM e apresentar o app ao time.
> Fonte: analise dos arquivos TypeScript/TSX e docs anexos (backend Fastify + frontend Next.js).

---

## Como usar no NotebookLM (setup rapido)

1. Suba este arquivo `.md` no NotebookLM como "Source".
2. (Opcional) Suba a versao `.pdf` junto - ela ajuda na leitura por pessoas e serve para onboarding.
3. Sugestao de prompts para o NotebookLM:
   - "Explique o fluxo de trabalho do Taskora para um analista novo."
   - "Quais filtros existem na tela de Tarefas e o que cada um faz?"
   - "Como gerar e exportar o Relatorio de Entregas por Cliente?"
   - "Liste todos os endpoints usados pelo frontend nas telas Tasks/Projects/Deliveries Report."

---

## 1) O que e o Taskora

Taskora e um painel operacional para agencias acompanharem clientes, projetos, tarefas, horas e (em camadas) metricas de midia paga.
O app combina:
- Operacao (tarefas, projetos, registro de horas)
- Organizacao por tenant (orgId) + papeis (gestor/analista/suporte)
- Relatorios (ex.: Entregas por Cliente, Horas)
- Integracoes e saude do "stack" de midia (Google Ads, Meta Ads, GA4, Pinterest) em modelo **offline-first**
- Assistente Gemini (Vertex) que responde e executa acoes usando dados internos (quando habilitado)

> Resumo pragmatico: "Taskora e o Jira + Timesheet + Relatorio de Entregas, so que falando a lingua da agencia."

---

## 2) Conceitos principais (para o time falar a mesma lingua)

### 2.1 Tenant / Organizacao (orgId)
Tudo no Taskora vive dentro de uma organizacao (orgId). O frontend envia `X-Org-Id` e o backend isola os dados por tenant.

### 2.2 Papeis (RBAC)
Papeis controlam permissoes:
- **gestor**: cria/edita quase tudo, arquiva, exporta, etc.
- **analista**: cria/edita dentro do escopo de operacao (tarefas, projetos, horas)
- **suporte**: geralmente leitura + relatorios

As rotas criticas aplicam:
- `app.authenticate` (token Firebase)
- `app.requireOrg()` (tenant)
- checks de role (ex.: rotas de relatorio permitem gestor/analista/suporte)

### 2.4 Nota de qualidade: labels ASCII (evitar caracteres quebrados)
O projeto padroniza labels de Tipo e Status em ASCII (ex.: "Relatorio", "Reuniao", "Concluida", "Em revisao") para evitar problemas de encoding em exportacoes e no Historico.
Se aparecer texto "m?s" ou nomes quebrados, normalmente e dado vindo do Firestore e nao um bug do front.


### 2.3 Estrutura Operacional
- **Cliente**: conta/empresa atendida pela agencia.
- **Projeto**: container de trabalho por cliente (ex.: "Vestibular 2025/2 - Google Ads").
- **Tarefa**: unidade de entrega (otimizacao, relatorio, criativo, reuniao, etc.).
- **Horas (time entries)**: registro de minutos por tarefa/projeto/usuario/data, com notas.
- **Historico / Timeline**: eventos sobre o cliente e as entregas (status, prazos, horas, reunioes, relatorios).

---

## 3) Entidades e campos (modelo mental)

> Observacao: os tipos completos vivem em `apps/*/src/types/*`. Aqui esta a "foto" do que aparece nas telas e nas rotas.

### 3.1 Task (Tarefa)
Campos que aparecem no backend/UI:
- `id`: string
- `title`: string
- `description`: string | null
- `type`: TaskType
- `status`: TaskStatus
- `dueDate`: ISO string | null
- `assignees`: string[] (ids de membros)
- `checklist`: itens `{ id?, label, done? }` (max 25)
- `integration`: (opcional) `{ provider, externalId, syncStatus, lastSyncAt, notes }`
- `createdAt`, `updatedAt`: ISO strings
- (em overview) snapshots:
  - `project`: `{ id, name, clientId }`
  - `client`: `{ id, name, segment, responsibleId }`

#### Status (TaskStatus)
Status operacionais (mencionados nas telas/docs):
- `backlog`
- `todo`
- `doing`
- `blocked`
- `review`
- `done`

#### Tipos (TaskType)
Tipos suportados (API + UI):
- `optimization` (Otimizacao)
- `report` (Relatorio)
- `creative` (Criativo)
- `meeting` (Reuniao)
- `feedback` (Feedback)
- `campaign` (Campanha)
- `billing` (Boleto)
- `note` (Nota)
- `other` (Outros)

#### Tags de prioridade (derivadas do prazo)
A API calcula um `priorityTag` para organizar a lista:
- `overdue` (atrasada)
- `due_today` (vence hoje)
- `upcoming` (proxima)
- `no_due_date` (sem prazo)
- `completed` (concluida)

### 3.2 Project (Projeto)
Campos usados na tela de Projetos:
- `id`, `name`
- `clientId`
- `status` (ex.: active/archived/etc - depende do type real)
- `ownerId` (dono/responsavel do projeto)
- `budget`/`value` (aparece formatacao de moeda na UI)
- `startDate`, `endDate`, `archivedAt` (quando aplicavel)

### 3.3 TeamMember (Membro)
Campos usados nas telas:
- `id`
- `name`
- `role`
- `status` (active/inactive)
- `color` (badge/identidade visual)

### 3.4 Time Entry (Horas)
Campos utilizados:
- `projectId`, `taskId`
- `date` (YYYY-MM-DD)
- `reportedMinutes` (numero)
- `notes` (opcional)

---

## 4) Telas principais (o que o time vai usar no dia-a-dia)

### 4.1 Tela: Tarefas (TasksPage.tsx)
**Objetivo:** lista consolidada de tarefas do org, com filtros, cards de prioridade, acoes rapidas e painel de detalhe ("Focus").

#### O que a tela carrega do backend
- `GET /tasks/overview` (dados para a lista + cards + filtros)
- `GET /team/members` (lista de responsaveis)
- `GET /time-entries/summary?projectId=...` (totais de horas por projeto)
- `GET /projects/:projectId/tasks` (quando abre tarefas por projeto)
- `PUT /projects/:projectId/tasks/:taskId` (acoes rapidas e edicao)
- `POST /time-entries` (registrar horas ao concluir)
- `POST /projects/:projectId/tasks` (criar tarefa)

#### Filtros da tela (state `TasksFiltersState`)
- Status (ou "all")
- Tipo (ou "all")
- Responsavel (assigneeId)
- Cliente (clientId)
- Projeto (projectId)
- Plataforma (platform) - valores: `google | meta | ga4 | pinterest | tiktok | other`
- Periodo (preset): `today | week | month | last7 | last30 | custom | none`
- Data custom: `from` / `to`
- Busca por texto: `search`

#### Cards operacionais (na parte de cima)
A API monta 3 blocos:
- **Hoje**
- **Esta semana**
- **Atrasadas**

Cada card traz um highlight (tarefa mais importante) + lista curta.

#### Acoes rapidas (no card/lista)
- Marcar como concluida (status = done)
- Marcar como revisao (status = review)
- Trocar status (qualquer um)
- (quando conclui) abre modal de horas para registrar minutos

#### Push notifications (opcional)
A tela de Tarefas inclui um card de opt-in de push (`PushOptInCard`). Quando habilitado:
- Sincroniza token quando a org ativa muda.
- Mostra botao de "Testar push" (chama `/notifications/test`) para validar entrega.


#### Fluxo especial: "Concluir tarefa -> Registrar horas"
1. Usuario clica "Concluir"
2. Front faz `PUT /projects/:projectId/tasks/:taskId` com `{ status: "done" }`
3. Se deu certo, abre modal para registrar horas
4. Modal faz `POST /time-entries` com:
   - `projectId`, `taskId`, `date`, `reportedMinutes`, `notes`
5. Atualiza resumo de horas do projeto e recarrega detalhe da tarefa

---

### 4.2 Tela: Projetos (ProjectsPage.tsx)
**Objetivo:** ver pipeline de projetos por cliente, criar/editar, arquivar e criar tarefa direto no projeto.

#### Chamadas principais
- `GET /projects` (com filtros `status` e `clientId`)
- `GET /clients?status=active` (para dropdown)
- `GET /team/members?status=active` (para owner/responsaveis)
- `POST /projects` (criar)
- `PUT /projects/:id` (editar)
- `DELETE /projects/:id` (arquivar)
- `GET /projects/:projectId/tasks` (painel de foco do projeto)
- `POST /projects/:projectId/tasks` (criar tarefa pelo modal do projeto)

#### Fluxos de uso
- Filtrar por cliente/status e buscar por nome/dono.
- Abrir "Focus" de um projeto para ver tarefas do projeto.
- Criar tarefa ja associada ao projeto (sem o usuario ter que escolher projeto de novo).

---

### 4.3 Tela: Relatorio de Entregas por Cliente (DeliveriesReportPage.tsx)
**Objetivo:** consolidar entregas concluidas em um periodo, agrupadas por cliente, e exportar PDF/CSV.

#### Filtros e ranges
- Modo:
  - `summary` (padrao) - foca em tipos "principais"
  - `all` - inclui todos os tipos
- Periodo rapido:
  - `this_month`, `last30`, `last7`, `custom`
- Periodo custom:
  - `from`, `to` (YYYY-MM-DD)
- Tipos:
  - por padrao, `summary` usa `["report", "feedback", "billing", "meeting"]`
  - o usuario pode marcar/desmarcar tipos (vira `useCustomTypes=true`)

#### Chamadas
- `GET /reports/tasks-by-client` (preview do relatorio)
- `GET /reports/tasks-by-client/export?format=pdf|csv` (download)
  - Usa `Authorization: Bearer <token>`
  - Usa `X-Org-Id` com org ativa
  - Le o `Content-Disposition` para sugerir nome de arquivo

---

## 5) Backend (rotas e regras) - foco em `tasks.ts` e `reports.ts`

### 5.1 Rotas de Tarefas e Historico (tasks.ts)

#### 5.1.1 Validacoes (Zod)
- `taskBodySchema`: cria tarefa (title obrigatorio; checklist max 25; assignees max 10)
- `taskUpdateSchema`: update parcial mas exige pelo menos 1 campo
- `overviewQuerySchema`: filtros do overview (status/type/assigneeId/clientId/projectId/platform/period/from/to/search)
- `historyQuerySchema`: filtros do historico/timeline

#### 5.1.2 /tasks/overview (GET)
Retorna um pacote completo para a UI:
- `metadata`: generatedAt, total, filtros aplicados
- `cards`: hoje/semana/atrasadas (highlight + itens)
- `totals`: por status e por tipo
- `filters`: listas para dropdown (assignees, clients, projects, platforms)
- `items`: lista final (ja ordenada por prioridade + prazo + updatedAt)

Regras importantes:
- Periodos `today/week/month/last7/last30/custom` viram um `dateRange`.
- "Atrasadas" e calculado ignorando o dateRange aplicado (para nao sumir atraso quando o usuario filtra outro periodo).
- Ordenacao:
  1. prioridade (overdue -> due_today -> upcoming -> no_due_date -> completed)
  2. prazo mais proximo primeiro
  3. updatedAt mais recente

#### 5.1.3 /tasks/history (GET)
Filtro de eventos por:
- cliente, projeto, responsavel
- tipo de evento (`note | meeting | integration | task | hour | report | alert`)
- periodo (`from/to`) e paginacao (`before`, `limit`)

> O objetivo do historico e contar "o que foi feito" com contexto legivel (sem IDs brutos).

#### 5.1.4 Notificacoes

#### 5.1.5 Eventos de timeline ao concluir tarefa (relevante para Historico e Relatorios)
Regra pratica (registrada no log do projeto):
- Se a tarefa concluida for do tipo `report`, registra evento `eventType=report` na timeline.
- Se for do tipo `meeting`, registra `eventType=meeting`.
- Para outros tipos, registra `eventType=task` com metadata `taskType` para exibir badge e manter contexto.

Isso melhora o Historico do cliente e deixa exportacoes mais "humanas" (menos "tarefa generica").

O backend chama `emitOrgNotification` (com try/catch via `safeNotify`) para emitir eventos de notificacao por org quando algo importante acontece.

---

### 5.2 Rotas de Relatorios (reports.ts)

#### 5.2.1 /reports/hours (GET)
Consolida horas em um intervalo:
- query: `startDate`, `endDate`, `projectId`, `userId`, `groupBy=day` (opcional)
- permissao: gestor/analista/suporte

#### 5.2.2 /reports/tasks-by-client (GET)
Gera JSON do relatorio de entregas:
- query obrigatoria: `periodStart`, `periodEnd`
- query opcional:
  - `mode`: `summary|all` (default summary)
  - `types`: lista CSV (ex.: "report,meeting")
- permissao: gestor/analista/suporte

#### 5.2.3 /reports/tasks-by-client/export (GET)
Exporta PDF ou CSV:
- `format=pdf|csv`
- nome do arquivo segue:
  - `Relatorio-de-Entregas_{orgSlug}_{YYYY-MM-DD}_modo-{summary|all}.pdf|csv`

---

## 6) Como o Relatorio de Entregas e calculado (tasks-by-client-report.ts)

### 6.1 O que entra no relatorio
1. Carrega tudo do org: tarefas, projetos, clientes, team members
2. Considera apenas tarefas com `status === "done"`
3. Descobre a data de conclusao:
   - procura no `activityLog` a ultima mudanca `status_change` para `done`
   - fallback: `updatedAt` quando status ja esta done
4. Filtra por periodo (start/end)
5. Filtra por tipos:
   - se `types` foi passado, usa ele
   - se nao e `summary`, inclui todos
   - se e `summary` e types nao foi passado, usa `SUMMARY_TASK_TYPES`
6. Exige que a tarefa tenha projeto com `clientId` valido (tarefa sem projeto/cliente nao aparece)

### 6.2 Como sai o JSON
Estrutura principal (exemplo simplificado):
```json
{
  "orgId": "org-dev",
  "orgName": "Dacora",
  "period": { "start": "ISO", "end": "ISO" },
  "mode": "summary",
  "filters": { "types": ["report", "meeting"] },
  "generatedAt": "ISO",
  "totals": { "clients": 12, "tasks": 64 },
  "clients": [
    {
      "clientId": "cli-123",
      "clientName": "Cliente X",
      "tasks": [
        {
          "id": "tsk-1",
          "title": "Relatorio semanal",
          "description": "texto...",
          "type": "report",
          "completedAt": "ISO",
          "projectId": "prj-9",
          "projectName": "Projeto Y",
          "assignees": [{"id":"u1","name":"Ana"}]
        }
      ]
    }
  ]
}
```

### 6.3 Export CSV
- Cabecalho fixo
- Separador `;` (pt-BR friendly)
- Colunas: Cliente, Projeto, Conclusao, Tipo, Tarefa, Responsaveis, Briefing

### 6.4 Export PDF (pdfkit)
- Cabecalho com metadados + logo da org (quando disponivel)
- Blocos por cliente com:
  - Resumo por tipo (contagem)
  - Lista de tarefas em linhas
  - Descricao truncada (3 linhas) com sufixo "[...] (texto completo no Taskora)"
  - Links detectados e "rotulados" (Instagram/Drive/YouTube/Notion/WhatsApp)
- Rodape com paginacao e data de geracao

---

## 7) Offline-first e integracoes (o que o time precisa saber, sem virar dev)

- A UI de clientes/metricas nao deve depender de chamadas em tempo real a APIs externas.
- IDs (Google Ads customer IDs, Meta ad account IDs, GA4 property IDs, Pinterest accounts) ficam salvos no cadastro do cliente.
- Jobs/schedulers alimentam caches (directory_clients, client_metrics_cache).
- Se algo falhar, a UI deve mostrar status amigavel (ok/degradado/offline) e seguir o guia de linguagem.

---

## 8) Boas praticas de operacao (para onboard do time)

- Sempre crie tarefas dentro de um projeto correto (evita "tarefa orfa" que nao entra em relatorio).
- Concluiu tarefa? Registra horas. Se nao registrar, o relatorio de horas vira fanfic.
- Use tipos de tarefa com intencao:
  - `meeting` para reunioes
  - `report` para entregas de relatorio
  - `billing` quando for boleto/fatura
  - `feedback` quando for retorno do cliente
- Para "fechamento do mes": use o Relatorio de Entregas por Cliente (PDF) + Relatorio de Horas.

---

## 9) Mapa dos arquivos analisados (para manutencao)

### Frontend (Next.js)
- `TasksPage.tsx` - tela de Tarefas (overview + focus + acoes rapidas + horas)
- `ProjectsPage.tsx` - tela de Projetos (CRUD + focus + criar tarefa)
- `DeliveriesReportPage.tsx` - tela de Relatorio de Entregas por Cliente (preview + export)

### Backend (Fastify)
- `tasks.ts` - rotas de overview/historico de tarefas + validacoes + notificacoes
- `reports.ts` - rotas de relatorios (hours, tasks-by-client, export)
- `tasks-by-client-report.ts` - regra de negocio do relatorio + export PDF/CSV

### Docs internas
- `visao_geral_app.md` - explicacao do app para adocao (nao-tecnica)
- `README_dev.md` - guia de desenvolvimento + lista de endpoints
- `Instrucoes_Novos_Chats.md` e `chat_novo.md` - processo e log de mudancas

---

## 10) FAQ rapido (para quem vai usar)

**"Se eu nao colocar projeto na tarefa, o que acontece?"**  
A tarefa existe, mas pode nao entrar em relatorios e perde contexto (cliente/projeto).

**"Por que tem tipo de tarefa?"**  
Porque o Taskora usa isso para organizar entregas e exportacoes mais claras.

**"O que e o 'Resumo' no relatorio de entregas?"**  
E um modo que filtra para os tipos que normalmente importam no fechamento (report/feedback/billing/meeting). Mas da pra customizar.

**"Por que o PDF corta o briefing?"**  
Para caber em formato executivo. O texto completo fica no Taskora; o PDF serve como vitrine/entrega.

---

## Glossario (mini)
- **OrgId / Tenant:** "empresa" dentro do sistema; isola dados.
- **RBAC:** controle de permissao por papel (roles).
- **Overview:** visao consolidada (cards + lista + filtros).
- **Time entries:** lancamentos de horas/minutos trabalhados.
- **Offline-first:** o app funciona a partir de cache interno; integracoes alimentam o cache via jobs.
- **MCP:** conectores/servicos internos (ex.: Pinterest MCP) usados pelo agente/rotinas.
