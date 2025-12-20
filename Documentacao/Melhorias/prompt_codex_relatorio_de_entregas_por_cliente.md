## Prompt para o Codex – Relatório de Entregas por Cliente (por organização)

Você é o dev sênior do **Taskora / Console Operacional**. O sistema já é multi-tenant (organizations, organizationMembers, orgId, requireOrg, OrgProvider, etc.) e já possui:

- Módulo de **Tarefas** (tasks) com vínculo a **clientes** e **projetos**.
- Módulo de **Histórico e execução** (timeline de eventos de tarefas, horas, notas etc.).

Na operação real, cada organização (ex.: Dácora, Allgrotech, Narah Lopes) precisa, toda semana ou todo mês, montar uma **prestação de contas** simples para uso interno e eventualmente para mostrar ao cliente:

> "O que fizemos para cada cliente nesse período?"

Hoje isso é feito na base da planilha/resumo manual. Queremos tirar a planilha da jogada e gerar esse **relatório direto a partir das tarefas** já registradas no Taskora.

---



### Roadmap desta sessao (pendencias)
- Push: teste nao entregou notificacao; inspecionar logs do Cloud Run (taskora-api), validar tokens em `push_subscriptions` e checar se o FCM esta enviando (`sendEachForMulticast`).
- Tarefas: alinhar o campo "Tipo" em todos os fluxos de criacao/edicao (modal principal, modal por projeto e modo Focus).
- Tarefas: adicionar novos tipos no enum/UI: Feedback, Campanha, Boleto, Nota (manter Relatorio, Reuniao, Otimizacao, Criativo, Outros).

## Objetivo deste desenvolvimento

Criar um **Relatório de Entregas por Cliente**, por organização e por período, que:

1. Agrupe as tarefas **por cliente**.
2. Para cada cliente, mostre um bloco assim:
   - Nome do cliente em destaque (título maior).
   - Abaixo, lista das tarefas concluídas no período selecionado (mês/semana), com informações relevantes (data, título, tipo/resumo).
3. Permita **filtrar quais tipos de tarefas entram** no relatório (ex.: só tarefas de resumo/relatório/boleto, ou todas as tarefas).
4. Permita **exportar** esse relatório (PDF/CSV) para uso interno ou envio ao cliente.
5. Respeite completamente o modelo multi-tenant (`orgId`): o relatório é sempre de uma organização de cada vez.

**Importante:**
- Não queremos recriar a planilha original como tela.  
- Queremos um **relatório agrupado por cliente**, baseado nas tarefas que já existem.

---

## Requisitos de produto (alto nível)

### 1. Escopo das tarefas consideradas

- Entram no relatório apenas tarefas que:
  - pertencem à organização ativa (`orgId` resolvido pelo `requireOrg`),
  - têm cliente associado (clientId),
  - foram **concluídas** dentro do período selecionado (por ex.: `completedAt` entre `periodStart` e `periodEnd`).

- Para cada tarefa, queremos pelo menos:
  - data de conclusão (ou data principal a exibir),
  - título da tarefa,
  - responsável (opcional mas desejável),
  - algum tipo/tags que nos ajude a filtrar (ver item 2).
  - briefing da tarefa

### 2. Filtro por tipo de entrega (resumos x todas as tarefas)

Quero que o relatório tenha, no mínimo, dois modos de exibição:

1. **Modo Resumos/Entregas principais**
   - Mostra apenas tarefas que representam "entregas macro" para o cliente, por exemplo:
     - Relatório mensal
     - Feedback semanal
     - Boleto / faturamento
     - Reunião de alinhamento
     - Outros tipos que a gente possa marcar como relevantes

2. **Modo Todas as tarefas**
   - Lista todas as tarefas concluídas no período, mesmo tarefas operacionais do dia a dia (subir campanha, criar criativo, ajustes menores etc.).

Você deve propor e implementar um mecanismo de classificação que permita esse filtro, por exemplo:

- reutilizar tags existentes em tasks (ex.: `relatorio_mensal`, `feedback`, `boleto`, `reuniao`), ou
- adicionar um campo de categoria/resumo em tasks (ex.: `summaryCategory?: "relatorio" | "feedback" | "boleto" | ...`),
- e/ou mapear critérios baseados em título (prefixos tipo "[RELATÓRIO]" etc.), se já existir esse padrão.

O importante é que a API de relatório aceite um parâmetro do tipo:

- `mode=summary` → só tarefas marcadas como "relevantes para resumo";
- `mode=all` → todas as tarefas concluídas.

### 3. Agrupamento por cliente

O relatório precisa agrupar as tarefas por cliente. Formato conceitual:

```ts
{
  orgId: string,
  periodStart: string,
  periodEnd: string,
  mode: "summary" | "all",
  clients: Array<{
    clientId: string,
    clientName: string,
    tasks: Array<{
      id: string,
      title: string,
      completedAt: string,
      assigneeName?: string,
      summaryCategory?: string; // quando aplicável
    }>;
  }>;
}
```

Se algum cliente não tiver nenhuma tarefa no período (no modo escolhido), ele pode ser omitido da resposta **ou** aparecer com a lista vazia – você decide o que fizer mais sentido e documenta.

---

## O que quero que você implemente (passos técnicos)

### 1. Serviço/backend de relatório

Crie um endpoint/serviço de relatório, algo como:

- `GET /reports/tasks-by-client`

Parâmetros:

- `orgId` → obtido via `requireOrg` (não confiar no cliente).
- `periodStart`, `periodEnd` (datas ISO).
- `mode` (opcional, default `summary`): `summary` | `all`.
- opcional: filtros adicionais (tags específicas, responsável etc.), se já houver padrão no código.

Esse endpoint deve:

1. Buscar todos os clientes da organização (ou somente clientes que tenham tarefas no período, se for mais eficiente).
2. Buscar tarefas concluídas no intervalo, filtradas por `orgId` e por modo (`summary`/`all`).
3. Agrupar as tarefas por cliente.
4. Ordenar:
   - clientes por nome (ou outro critério que já usem),
   - tarefas dentro do cliente por data de conclusão (mais recentes primeiro, por exemplo).

### 2. Classificação de tarefas para o modo "summary"

- Definir, em algum lugar central (config ou enum), quais tarefas contam como **"resumo/entrega principal"**.
- Exemplos de critério (ajuste conforme o modelo real do projeto):
  - tags: `relatorio_mensal`, `feedback_semana`, `boleto`, `reuniao`;
  - tipo/categoria de tarefa: `REPORT`, `FEEDBACK`, `BILLING`, etc.
- Implementar a lógica de filtragem no backend, para que o modo `summary` traga apenas essas tarefas.
- Documentar no código e, se possível, em `Documentacao/` quais tags/tipos estão sendo usados.

### 3. UI do Relatório de Entregas

Crie uma tela (ou aba) chamada algo como **"Relatórios → Entregas por Cliente"** ou **"Resumo por Cliente"**, que:

1. Use o `activeOrgId` já existente (multi-tenant).
2. Tenha controles de filtro:
   - intervalo de datas (atalhos tipo "este mês", "últimos 30 dias" ajudam);
   - seletor de modo: `Resumos` (summary) x `Todas as tarefas` (all).
3. Renderize para cada cliente um bloco visual tipo:

```text
CLIENTE VETSELL
- 03/12 – Relatório Mensal Dezembro (Flávio)
- 05/12 – Feedback Semana 1 (Fulano)
- 10/12 – Boleto Mensal (Ciclano)
...

CLIENTE XYZ
- ...
```

Ou usando os componentes de card/typography do próprio app:

- Nome do cliente como título H2/H3.
- Lista de tarefas embaixo, com data + título + responsável/tags.

4. Respeitar os filtros (modo, período) em todas as consultas.

### 4. Exportação do relatório

Adicionar botões para exportar o relatório atual (respeitando modo e filtros):

- `Exportar PDF`
- `Exportar CSV`

Requisitos:

- O PDF deve trazer, em uma página ou várias, os clientes com suas listas de tarefas, em layout limpo (bom pra mandar pro cliente ou anexar em dossiê interno).
- O CSV pode ser uma tabela com colunas: `org`, `client`, `completedAt`, `taskTitle`, `assignee`, `summaryCategory`.

Você pode implementar a exportação no backend (gerando PDF/CSV) ou, se o projeto já tiver padrão, reaproveitar esse padrão.

### 5. Testes e documentação

- Crie testes para o endpoint `/reports/tasks-by-client`, cobrindo:
  - modo `summary` x `all`;
  - período com e sem tarefas;
  - agrupamento correto por cliente.
- Adicione uma documentação curta em `Documentacao/Relatorios/relatorio_entregas_por_cliente.md` (ou similar) explicando:
  - propósito do relatório;
  - campos que aparecem;
  - diferença entre `Resumos` e `Todas as tarefas`;
  - qualquer detalhe de configuração (tags/tipos usados para classificar tarefas relevantes).

---

## Estilo de entrega

- Seja incremental: primeiro backend, depois UI, depois exportações.
- Não remova nada do módulo de histórico; este relatório é uma visão complementar.
- Nomeie bem os tipos e funções para que o propósito fique claro (por ex.: `getTasksByClientReport`).

Ao finalizar, faça um resumo das mudanças:

1. Qual endpoint/serviço novo foi criado e como é o payload.
2. Como a classificação de tarefas "resumo" x "todas" foi implementada.
3. Como a tela de relatório funciona (filtros, agrupamento por cliente).
4. Como funciona a exportação (formato e filtros respeitados).

