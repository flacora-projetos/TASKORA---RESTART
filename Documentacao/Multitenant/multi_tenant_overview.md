## Ajustes do lead
- Confiabilidade: o backend é a fonte da verdade do `orgId`. O cliente pode enviar um header/sinal, mas o serviço sempre valida membership `(orgId, userId)` antes de ler/gravar. Não confiar apenas em `activeOrgId` vindo do front.
- Compatibilidade: durante a transição, dados sem `orgId` recebem fallback `orgId="Dacora"` só para leitura/escrita temporária, com log/TODO para limpeza na Fase 3.
- Seleção de organização: se o usuário tem 1 org, selecionamos automaticamente e ocultamos o seletor; se tem >1, seletor visível; se 0, bloqueio “sem organização atribuída”.
- Armazenamento do contexto: `activeOrgId` fica no contexto do front e opcionalmente em `users/{uid}.activeOrgId` para reabrir com a última org. LocalStorage é apenas cache auxiliar.

## Visão geral da solução
- Introduzir `organizations` (workspaces) com metadados simples (nome, slug, createdAt, owner opcional).
- Mapear membership explícito (usuário Firebase ↔ organização) via coleção dedicada; cada sessão mantém um `activeOrgId`.
- Todas as entidades de domínio passam a carregar `orgId` obrigatório; todas as queries/rotas/serviços filtram por `orgId` e validam membership no backend.
- Na UI, adicionar seletor de organização (topo da sidebar/header). Ao trocar, recarregar dados com o novo `orgId` e limpar caches/filtros.

## Modelo de dados proposto
- Coleções:
  - `organizations`: `{ id, name, slug, createdAt, updatedAt, ownerUid? }`
  - `organizationMembers`: coleção de junção `{ orgId, userId, roles?: ["admin"|"member"], createdAt }` (docId recomendado `${orgId}_${userId}` para unicidade lógica).
  - Alternativa: subcoleção `members` em `organizations` (preferimos coleção plana para índices por usuário).
- Entidades com `orgId` obrigatório: `clients`, `projects`, `tasks`, `time_entries`, `client_timeline`, `client_metrics_cache`/status, `push_subscriptions`, `insight_posts`/`feedback_posts`/`comments`/`votes`, e qualquer cache/relatório (ex.: `metrics/spend-overview`, `tasks_history`).
- Firestore `users`: manter como hoje; adicionar `orgIds` (lista) e opcional `activeOrgId` cacheado.
- Índices: compor `orgId` com os campos de filtro já existentes (clients: orgId+status/segmento/responsável; projects: orgId+clientId/status; tasks: orgId+status/responsável/clientId/projectId/dueDate; time_entries: orgId+date/userId/projectId; client_timeline: orgId+clientId/occurredAt; insights: orgId+status/type/createdAt; push_subscriptions: orgId+userId).

## Fluxo de autenticação + contexto de organização
- Login Firebase normal.
- Após login:
  - Buscar memberships do usuário em `organizationMembers` (userId == uid), join com `organizations`.
  - Definir `activeOrgId`: última usada (user doc ou localStorage) ou primeira da lista; se apenas uma, selecionar automaticamente.
  - Armazenar `activeOrgId` em contexto global (React context/Zustand já usado para auth) e expor hook `useActiveOrg`.
  - Todas as chamadas de dados usam `orgId` do contexto; o backend revalida membership e ignora `orgId` malicioso vindo do cliente.
- Token/claims: opcional colocar `orgIds` no custom claim para otimizar; não obrigatório na primeira entrega.

## Troca de organização na UI
- Seletor no topo da sidebar/header (ao lado do usuário). Mostra nome/slug e dropdown com organizações do usuário.
- Ao trocar:
  - Atualiza `activeOrgId` no contexto, persiste em localStorage/user doc.
  - Reseta filtros da tela corrente e invalida caches (React Query/estado local) para refetch com `orgId` novo.
  - Estado de loading curto com skeleton/spinner; evitar hard reload.
- Se usuário só pertence a uma org, ocultar seletor; se nenhuma, mostrar bloqueio “sem organização atribuída”.

## Plano de migração dos dados atuais
- Criar documento `organizations/Dacora` (slug `dacora`).
- Criar `organizationMembers` para os usuários atuais (uid do time) com `orgId=Dacora`.
- Atualizar todas as coleções existentes adicionando `orgId: "Dacora"` (scripts idempotentes em Cloud Run/local usando Admin SDK).
- Ajustar índices para incluir `orgId`.
- Validar: smoke tests de páginas principais (clientes/projetos/tarefas/horas/histórico/insights) filtrando por org; checar regras de segurança (se aplicadas) para bloquear acesso cruzado.
- Opcional: guardar `activeOrgId` em `users/{uid}.activeOrgId = "Dacora"` para pré-seleção.

## Roadmap de implementação em etapas
- **Fase 1 (Fundação)**:
  - Criar coleções `organizations` e `organizationMembers`.
  - Adicionar `orgId` aos tipos/esquemas/DTOs principais (API + front models) com fallback temporário `orgId="Dacora"` apenas durante transição.
  - Contexto `activeOrgId` no front; API recebendo `orgId` e validando membership.
- **Fase 2 (Módulos críticos)**:
  - Adaptar repositórios/rotas: clients, projects, tasks, time_entries, timeline, metrics caches, insights, push_subscriptions.
  - Atualizar hooks/queries no front para sempre passar `orgId`.
  - Seletor de organização na UI; reset de filtros/cache ao trocar.
- **Fase 3 (Migração e hardening)**:
  - Rodar scripts de migração para `orgId=Dacora` em todos os dados legados.
  - Criar índices compostos com `orgId`.
  - Regras de segurança/guardrails: validar membership antes de servir dados; remover fallback `orgId="Dacora"`; testes de acesso cruzado; limpeza de qualquer rota/cache sem `orgId`.
  - Preparar cadastro das demais orgs (Allgrotech, Narah Lopes) e memberships.

## Riscos e pontos de atenção
- Esquecer algum módulo sem `orgId` → vazamento de dados entre orgs.
- Consultas sem índice `orgId + filtros` → falhas em produção; mapear e criar índices antes do rollout.
- Regras de segurança/backs: precisam validar membership por `orgId` sempre; não confiar em header isolado.
- Custo de leitura pode subir com mais filtros/queries; monitorar.
- Decisões pendentes: nomes/slugs oficiais das orgs iniciais (Dacora, Allgrotech, Narah Lopes), roles binárias (admin/member) ou outra granularidade, comportamento do seletor (sempre visível vs auto-hide quando só 1 org).
