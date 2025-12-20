# Codex 5.1 — Ajustes rápidos de multi-tenant + permissões (sem overengineering)

## Objetivo (em miúdos)
1) **Filtrar os saldos/investimentos do Dashboard por Org ativa** (sem pegar nada global).
2) **Sumir com a aba “Configurações” na Visão 360 do Cliente** para quem **não** for admin.
3) Criar um papel **admin** para ver/editar configurações sensíveis e **restringir esse papel apenas** para:
   - `flacora@gmail.com`
   - `contato@nandacora.com.br`

> Importante: **não mudar a visibilidade dos saldos**. Usuários não-admin podem continuar vendo os saldos **da Org ativa**. O que muda é só garantir que esses saldos sejam 100% **org-scoped**.

---

## Regras / Segurança (obrigatório)
- Não confiar só no front: o **backend deve bloquear** endpoints sensíveis (Configurações do cliente) para não-admin.
- O scoping por Org deve ser garantido no backend usando `requireOrg()`/`X-Org-Id`.
- Para saldos do dashboard: **não** usar `requireAdmin()`; apenas `requireOrg()` e scoping correto.

---

## Passo 0 — Descobrir onde mexer
1) Localize no `apps/web` qual componente do **Dashboard** renderiza “Panorama de investimento / saldos”.
2) Localize no `apps/api` qual endpoint alimenta esses saldos.
3) Localize no `apps/web` a página/rota de **Cliente 360** e onde as **abas** são definidas (incluindo “Configurações”).

---

## Parte A — RBAC: definir “admin” (allowlist de e-mails)
### A1) Implementar um helper central no backend
Crie um helper único (ex.: `apps/api/src/auth/is-admin.ts` ou similar) que retorne `true` se `user.email` estiver na allowlist.

Allowlist fixa (por enquanto):
- `flacora@gmail.com`
- `contato@nandacora.com.br`

### A2) Middleware/Guard
Adicionar um guard `requireAdmin()` (sem mexer no `requireOrg()`), usado **somente** em rotas sensíveis de **Configurações do Cliente** (integrações/IDs e ações de link/editar/remover integrações).

> **Não** usar `requireAdmin()` nos endpoints de saldos do dashboard. Esses devem continuar acessíveis para qualquer usuário autenticado **dentro da Org ativa**, com `requireOrg()`.

Retornar `403` com mensagem clara.

### A3) Expor “isAdmin” pro front
Se já existir endpoint de “me/session”, incluir `isAdmin`.
Se não existir, crie um endpoint pequeno:
- `GET /me` (ou `/auth/me`) → `{ email, uid, orgId, isAdmin }`

---

## Parte B — Dashboard: saldos/investimento **por Org**
### B1) Filtrar por Org ativa (sem diretório global)
A regra é:
- Os saldos do dashboard devem ser calculados **somente** a partir dos **clientes internos** daquela Org (que já têm `orgId`).
- Para cada cliente interno, usar apenas os IDs de integrações armazenados nele (ex.: `googleCustomerIds`, `metaAccountIds`, etc.).

Evitar:
- Ler `directory_clients` global.
- Somar qualquer coisa sem passar pelo `orgId`.

### B2) Visibilidade (não mexer)
- **Admin e não-admin** continuam vendo o painel de saldos **da Org ativa**.
- Não implementar bloqueio por role para saldos.

> O que precisa existir é: saldos sempre org-scoped (via `requireOrg()`/`X-Org-Id`) e sem leitura do diretório global.

### B3) Aceite
- Ao trocar a Org no seletor, o painel de saldos muda para refletir **apenas** os clientes daquela Org.
- Usuário não-admin consegue ver os saldos **da Org ativa** normalmente.
- Nenhuma Org consegue ver saldos de outra Org (mesmo se tentar manipular chamadas/headers).

---

## Parte C — Cliente 360: esconder “Configurações” para não-admin
### C1) UI
Na página de Cliente 360:
- Condicionar renderização da aba “Configurações” a `isAdmin === true`.
- Se existir rota direta/URL para a tab, bloquear acesso (redirect para Visão Geral ou 403 UI).

### C2) Backend
Identificar endpoints usados pela aba Configurações (integrações, link-directory, updateIntegrations, etc.).
- Para **read** de configurações/IDs e qualquer ação sensível: exigir `requireAdmin()`.
- Atenção: ações operacionais comuns (tarefas/projetos) não devem ser afetadas.

### C3) Aceite
- Usuário não-admin não vê a aba.
- Usuário não-admin não consegue acessar os dados/configs via API (403).

---

## Parte D – Módulo Equipe: somente admin pode gerenciar membros + escolher role
### D1) Restringir ações de membros
No módulo **Equipe/Times** (Administração/Cadastro de integrantes):
- Esconder/desabilitar UI de **Adicionar membro**, **Editar role**, **Remover/Arquivar** para não-admin.
- Mostrar mensagem curta: “Apenas administradores podem gerenciar membros da organização.”

### D2) Role na criação
Ao adicionar membro, incluir um seletor de role (dropdown):
- `member` (padrão)
- `admin`

Regras:
- Só usuários `isAdmin=true` veem o dropdown.
- Mesmo para admin, o backend deve validar: só permitir atribuir `admin` se o e-mail do convidado estiver na allowlist (`flacora@gmail.com`, `contato@nandacora.com.br`). Para qualquer outro e-mail, forçar `member` (ou retornar 400/403 com mensagem clara).

### D3) Backend (obrigatório)
Identificar endpoint(s) usados para:
- criar membro/convite
- alterar role
- remover/arquivar

Aplicar `requireAdmin()` nesses endpoints.

---

## Testes mínimos
1) API: chamar endpoint(s) de **Configurações do cliente** como não-admin → `403`.
2) UI: Cliente 360 renderiza sem aba Configurações para não-admin.

## Validação (prévia hospedada)
- Para cada entrega, gerar uma URL de prévia do Hosting (firebase hosting:channel:deploy) e compartilhar no chat para validação antes do deploy final em produção.
- Objetivo: permitir teste sem impacto em produção e com rollback simples (expirar canal ou não promovê-lo).

## Entrega (no final)
- Liste arquivos alterados.
- Descreva o fluxo do dashboard (de onde vem os saldos e como filtra por org).
- Confirme quais endpoints ficaram protegidos por `requireAdmin()`.
- Mostre como `isAdmin` chega no front.
