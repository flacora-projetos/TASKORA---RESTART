## Prompt para o Codex — Implementar multi-tenant (Fase 1 e Fase 2)

Você é o dev sênior deste projeto **Taskora**, um painel operacional para agência de marketing digital, feito em **React + Firebase/Firestore + Cloud Run**, já com módulos de Clientes, Projetos, Tarefas, Horas, Histórico de tarefas, Métricas de mídia, Central de Insights e Assistente Gemini.

Você TEM acesso completo ao repositório e ao terminal. Não peça para o usuário rodar comandos.

Já existe um documento de arquitetura descrevendo o modelo multi-tenant:
- `Documentacao\Multitenant\multi_tenant_overview.md`

Considere esse documento como **fonte da verdade** sobre a solução desejada (organizations, organizationMembers, orgId obrigatório, activeOrgId, seletor de organização na UI, roadmap de fases, riscos etc.). O backend sempre valida membership `(orgId, userId)`; o orgId vindo do cliente não é confiado isoladamente.

---

## Objetivo deste prompt

Implementar a **Fase 1** e a **Fase 2** do roadmap definido em `multi_tenant_overview.md`, deixando o Taskora pronto para ter múltiplas organizações (Dacora, Allgrotech, Narah Lopes), mas ainda com todos os dados existentes na Dacora.

Nesta etapa NÃO precisamos ainda:
- do script completo de migração (isso é Fase 3),
- nem de regras de segurança Firestore ultra refinadas.

Queremos o app funcionando em multi-tenant de forma básica, com `orgId` já presente em tudo e o seletor de organização ativo.

---

## Passos esperados (alto nível)

Siga mais ou menos esta ordem, ajustando se fizer sentido ao ler o código:

### 1. Ler o documento de arquitetura
1. Abra `Documentacao\Multitenant\multi_tenant_overview.md` e leia com atenção.
2. Se houver divergência entre esse documento e qualquer outra coisa, **siga o documento**.

### 2. Criar modelo de dados de organizações (Fase 1)
1. Criar a coleção `organizations` com o shape descrito no doc (ex.: `id`, `name`, `slug`, `createdAt`, `updatedAt`, `ownerUid?`).
2. Criar a coleção de junção `organizationMembers` com `{ orgId, userId, roles?: ["admin"|"member"], createdAt }` ou equivalente. DocId preferido `${orgId}_${userId}` para unicidade.
3. Se existir camada de tipos (TypeScript) ou modelos de domínio, adicionar os tipos para `Organization` e `OrganizationMember` aqui.

### 3. Incluir `orgId` nos modelos/DTOs principais (Fase 1)
1. Identificar as entidades de domínio listadas no doc de arquitetura que precisam de `orgId` obrigatório, por exemplo:
   - clients
   - projects
   - tasks
   - time entries / hours
   - client_timeline / histórico de tarefas
   - métricas/cache de cliente (client_metrics_cache, status de integrações, etc.)
   - posts da Central de Insights (insight_posts, feedback_posts, comments, votes)
   - push_subscriptions
   - qualquer cache/relatório relevante (tasks_history, metrics_overview, etc.)
2. Atualizar os tipos/interfaces/DTOs para incluir `orgId: string` como campo obrigatório.
3. Ajustar factories/helpers que criam documentos novos para já receberem e preencherem `orgId`.

> **Importante:** nesta etapa, você pode usar um valor fixo temporário `"Dacora"` ou similar, desde que isso venha de um lugar centralizado (ex.: função `getActiveOrgId()`); o backend deve validar membership e rejeitar orgId que não pertença ao usuário.

### 4. Criar contexto de organização ativa no front (Fase 1)
1. Ver como o estado de autenticação já é gerenciado (React context, Zustand, Redux, etc.).
2. Criar um contexto/hook `useActiveOrg()` (nome pode variar, mas a ideia é essa) que exponha:
   - `activeOrgId`
   - `setActiveOrgId(orgId)`
   - lista de `organizations` do usuário logado
3. Implementar a lógica de bootstrap após login:
   - Buscar memberships do usuário em `organizationMembers` (por `userId == uid`).
   - Fazer join para pegar metadados das `organizations`.
   - Definir `activeOrgId` inicial (última usada, se houver; senão a primeira org da lista). Se só houver uma org, selecionar automaticamente e ocultar seletor.
   - Persistir `activeOrgId` em localStorage e opcionalmente no doc `users/{uid}.activeOrgId` para reaproveitar em futuros logins.

### 5. Adaptar camada de acesso a dados para usar `orgId` (Fase 2)
1. Identificar a camada de acesso ao Firestore (services/repos/hooks de dados).
2. Refatorar **gradualmente** para que toda query de domínio:
   - receba `orgId` como parâmetro OU
   - leia `activeOrgId` do contexto interno (não importa o padrão, desde que seja consistente).
3. Garantir que, em todas as consultas a coleções multi-tenant, haja um filtro `where("orgId", "==", activeOrgId)` ou equivalente **e** validação de membership no backend.
4. Atualizar rota(s) de API (se houver backend intermediário) para sempre exigir/propagar `orgId` até o repositório.

### 6. Seletor de organização na UI (Fase 2)
1. Escolher o ponto de entrada visual (provavelmente no topo da sidebar ou do header onde hoje mostra usuário/conta).
2. Criar um componente de seletor de organização que:
   - liste as `organizations` associadas ao usuário,
   - mostre claramente qual está ativa,
   - permita trocar `activeOrgId` com clique simples.
3. Ao trocar de organização:
   - atualizar `activeOrgId` no contexto,
   - persistir no localStorage (ou similar),
   - invalidar caches de dados e refazer queries com o novo `orgId`,
   - resetar filtros das telas para um estado padrão para evitar confusão.
4. Se o usuário tiver **apenas uma** organização, o seletor pode ser oculto.

### 7. Ajustar telas principais para funcionar com multi-tenant (Fase 2)
1. Garantir que as telas de:
   - Dashboard
   - Clientes
   - Projetos
   - Tarefas
   - Horas / time entries
   - Histórico de tarefas
   - Central de Insights
   mostrem dados da `activeOrgId`.
2. Verificar se existe alguma rota ou componente que ainda carrega dados sem filtro por organização e corrigir.

---

## O que NÃO fazer agora
- Não implementar ainda o script completo de migração (Fase 3). Você pode deixar um TODO/documentação apontando como isso deve ser feito, respeitando o doc de arquitetura.
- Não refatorar tudo de uma vez se puder fazer isso de modo incremental (commits pequenos, fáceis de revisar).

---

## Estilo de trabalho esperado
1. **Passos pequenos e descritivos**  
   - Faça mudanças em blocos lógicos (ex.: "adicionar orgId nos tipos de tasks e clients"; "criar contexto de organização ativa", etc.).
   - Ao final, escreva um resumo do que foi alterado (arquivos principais, decisões tomadas, qualquer divergência mínima do doc de arquitetura).
2. **Preservar compatibilidade**  
   - Evite quebrar o app inteiro no meio da refatoração. Se precisar, crie caminhos temporários (ex.: tratar casos sem `orgId` ainda) e marque com TODO para limpeza na Fase 3.
3. **Documentar onde fizer sentido**  
   - Atualize/adicione documentação rápida em `docs/` ou comentários sucintos quando introduzir conceitos novos (`orgId`, `activeOrgId`, seletor de org, etc.).

Quando terminar, descreva:
- quais coleções/entidades agora têm `orgId`,
- como o `activeOrgId` é determinado e armazenado,
- onde está o seletor de organização na UI,
- qualquer ponto que ainda dependa da Fase 3 (migração de dados e hardening de segurança).
