## Prompt para o Codex – Reatribuir clientes e seus dados para novas organizações

Você é o dev sênior deste projeto **Taskora**, um painel operacional para agência de marketing digital, feito em **React + Firebase/Firestore + Cloud Run**, já com multi-tenant implementado (organizations, organizationMembers, orgId obrigatório, requireOrg, OrgProvider, etc.).

Você TEM acesso completo ao repositório e ao terminal. Não peça para o usuário rodar comandos.

### Contexto atual

* Multi-tenant (Fases 1/2/3) já está implantado.
* Todos os documentos de domínio relevantes já possuem `orgId` preenchido, atualmente **Dacora** (via script `add-org-id` com `SEED_ORG_ID=Dacora`).
* Já existem (ou existirão) as seguintes organizações em `organizations`:

  * `Dacora` (org principal)
  * `Allgrotech`
  * `Narah Lopes`
* Na prática, hoje **todos os clientes, projetos, tarefas etc. residem em Dacora**, mas alguns desses clientes deveriam pertencer a outras orgs (ex.: clientes atendidos via Allgrotech, clientes individuais da Narah Lopes).

O que eu, como P.O., quero agora é **redistribuir** alguns clientes (e todos os dados ligados a eles) para outras organizações, sem fazer isso manualmente na mão, item por item.

---

## Objetivo deste prompt

Criar uma solução de migração controlada para:

1. Definir um **mapeamento de clientes → organização de destino** (ex.: certos clientes vão para Allgrotech, outros para Narah).
2. Rodar um **script de reatribuição** que:

   * atualiza o `orgId` do cliente;
   * atualiza o `orgId` de **todos os artefatos ligados a esse cliente** (projetos, tarefas, horas, timeline, insights, métricas, etc.), mantendo a consistência de tenant;
   * seja **idempotente** e logue tudo o que fez.

A ideia é: eu marco em um arquivo de configuração quais clientes são Allgrotech, quais são Narah, e o script faz a reatribuição em cascata.

---


## Execucao (passo a passo)
1. Preencha `Documentacao/Multitenant/org_client_map.json` com o campo `org` (D/A/N).
2. Rode a migracao: `pnpm --filter @taskora/api exec tsx scripts/reassign-clients-orgs.ts --apply`.
3. Para liberar o seletor de organizacao no app, preencha `Documentacao/Multitenant/org_members_map.json` e rode `pnpm --filter @taskora/api exec tsx scripts/sync-org-members.ts --apply`.
4. Clientes arquivados continuam arquivados (a migracao so altera `orgId`).
