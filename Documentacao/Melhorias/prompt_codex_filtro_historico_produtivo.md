## Prompt para o Codex – Filtro de Histórico "Produtivo" (Timeline enxuta)

Você é o dev sênior do **Taskora / Dácora Console Operacional**. Já existe o módulo **Histórico e execução** (`/tasks/history`), com filtros por cliente, projeto, responsável, tipo de evento (Tarefa, Horas, Nota, Reunião, Relatório, Integração, Alerta, Todos) e período (Últimos 7 dias, 15 dias, 30 dias, Personalizado). A listagem mostra uma timeline com eventos como:

- "Status atualizado: Concluída" (mudanças de status)
- "Prioridade ajustada" (mudanças de prioridade)
- "Prazo atualizado" (mudanças de data)
- Criação de tarefa
- Registros de horas
- Notas, reuniões, relatórios, integrações etc.

Na prática, o histórico está **poluído de microeventos operacionais** (cada ajuste de status/prioridade/prazo vira um card completo). Para uso de gestão e prestação de contas com o cliente, isso gera muito ruído.

O que eu, como P.O., quero agora é introduzir uma **visão mais enxuta do histórico**, focada em "o que foi feito para o cliente" e não em todos os pequenos ajustes.

---

## Objetivo desta mudança

Criar um modo/filtro de histórico **"produtivo" / "resumo de execução"** que esconda eventos operacionais de baixo valor e destaque apenas as ações relevantes, sem quebrar o que já existe hoje.

Quero duas visões convivendo:

1. **Visão detalhada** (como é hoje) – para auditoria, troubleshooting, etc.
2. **Visão produtiva / Resumo de execução** – para eu bater o olho e ver o que realmente entregamos para o cliente em um período.

Essa visão produtiva deve ser acessível:

- ou via um **toggle** (ex.: `Detalhado` / `Resumo`),
- ou via um novo preset de filtro (ex.: botão "Eventos produtivos"), ou mesmo uma aba no Historico produtivo e que ela seja a primeira aba ao abrirmos a página de Historico.
- mantendo o comportamento atual como opção.

---

## Diretrizes de produto

### 1. O que deve ser considerado "evento produtivo" (alto nível)

Quando eu ativar o modo **Resumo/Produtivo**, quero ver principalmente:

- **Fechamento de tarefas** relevantes:
  - Mudanças de status para `Concluída` (e eventualmente `Cancelada`, se existir) – ou seja, a "entrega" da tarefa.
- **Registros de horas** (`Horas`):
  - tudo que for time entry real de trabalho.
- **Notas** que tenham sido lançadas para o cliente/projeto/tarefa.
- **Reuniões** registradas.
- **Relatórios** gerados/registrados.


Em contrapartida, quero que sejam **escondidos** por padrão no modo Resumo:

- Mudanças de status intermediárias (A fazer → Em andamento → Em revisão, etc.), exceto o fechamento (→ Concluída/Cancelada).
- Ajustes de prioridade (Prioridade ajustada).
- Reagendamentos de prazo (Prazo atualizado) que não são fechamento.
- Qualquer outro evento de "ajuste de meta dado" que não represente trabalho diretamente executado ou algo concreto entregue.

### 2. Não quero perder os dados brutos

- Nada deve ser apagado.  
- O que muda é **só a forma de filtrar/mostrar**.

---

## O que eu quero que você faça (passos técnicos)

### 1. Entender o modelo atual de eventos de histórico

1. Localizar onde o histórico é modelado no backend (ex.: tipos `TaskHistoryEvent`, coleções Firestore, services de histórico, etc.).
2. Mapear como os eventos de tarefa são armazenados hoje:
   - tipos de evento (status change, priority change, due date change, created, etc.);
   - campos que já existem para classificar o evento (`type`, `action`, etc.).
3. Mapear a API usada pelo front para `/tasks/history` (rota, parâmetros, filtros já suportados).

Se o modelo atual não tiver um campo explícito que diferencie bem ações (ex.: `action: "status_changed" | "priority_changed" | ...`), proponha um ajuste mínimo nesse modelo para ficar mais estruturado.

### 2. Introduzir uma classificação "relevância" ou "categoria" de evento

Quero que você introduza uma forma clara de marcar, no modelo de histórico, quais eventos são "produtivos" versus "operacionais". Exemplos de caminhos aceitáveis:

- Campo booleano `isRelevantForSummary` (ou nome equivalente); ou
- Campo `category: "operational" | "value" | ...`; ou
- Derivar isso de `type` + `action` sem persistir (desde que fique fácil de manter).

Você decide o melhor design, mas precisa atender às regras de produto:

- Eventos considerados produtivos (para o resumo):
  - `Tarefa` com mudança de status para Concluída/Cancelada;
  - `Horas` (time entries);
  - `Nota`;
  - `Reunião`;
  - `Relatório`;
  - Integrações que representem envio/registro para o cliente (se aplicável);
  - Alertas importantes, se fizer sentido (pode me sugerir isso).
- Eventos considerados apenas operacionais (para esconder no resumo):
  - mudanças de prioridade;
  - mudanças de prazo;
  - mudanças de status intermediárias (que não sejam fechamento/encerramento);
  - qualquer outro ajuste interno que você identificar.

Documente claramente no código e/ou em `Documentacao/` qual é a regra de mapeamento.

### 3. Ajustar a API de histórico para suportar o modo "produtivo"

Na rota/serviço que alimenta `/tasks/history`, quero um parâmetro opcional, algo como:

- `mode=summary` / `mode=detailed`, ou
- `relevantOnly=true`,

que faça a API:

- retornar **apenas eventos marcados como produtivos** quando o modo resumo estiver ativo;
- manter o comportamento atual quando o modo detalhado estiver ativo (ou quando o parâmetro não for enviado).

A implementação pode ser:

- via filtro no backend (preferred);
- ou via filtro no front em cima de todos os eventos (aceitável temporariamente, se a carga não for grande).  

Dê preferência à filtragem no backend se o custo não for alto.

### 4. Ajustar o front (UI de Histórico e execução)

Na tela de histórico (`/tasks/history`), implemente um controle claro para alternar entre:

- **Visão detalhada** (tudo); e
- **Visão produtiva / Resumo** (apenas eventos relevantes).

Pode ser, por exemplo:

- Um toggle/segmented control no topo, ao lado de "Eventos mais recentes primeiro";
- Ou um pill extra de tipo de evento (ex.: `Resumo` vs `Todos`).

Requisitos de UX:

- O padrão pode continuar sendo o modo atual (detalhado), mas avalie se faz sentido lembrar a escolha do usuário (localStorage) e me explique a decisão.
- Ao alternar o modo, a listagem deve ser recarregada respeitando também os filtros já selecionados (cliente, projeto, responsável, período).

### 5. Exportações (CSV/PDF)

Hoje existem botões de **Exportar CSV** e **Exportar PDF** nessa tela. Quero que eles respeitem o modo atual:

- Se eu estiver no modo detalhado → exportar tudo como hoje.
- Se eu estiver no modo produtivo → exportar apenas os eventos filtrados (produtivos).

Se for complexo no momento, você pode manter a exportação sempre detalhada, mas nesse caso deixe isso:

- bem sinalizado no código (TODO) e,
- se possível, indicado na UI (ex.: tooltip ou texto curto: "Exportação sempre considera todos os eventos").

### 6. Testes e documentação

- Atualize ou crie testes para a lógica de filtragem (unitário ou de serviço):
  - casos de status intermediário vs Concluída;
  - prioridade/prazo vs horas/notas;
  - combinação com filtros de cliente/projeto/período.
- Documente rapidamente em `Documentacao/Multitenant` ou em um novo doc para o módulo de histórico:
  - como funciona o modo Resumo;
  - o que é considerado evento "produtivo";
  - exemplos práticos.

---

## Estilo de entrega esperado

- Trabalhe de forma incremental: primeiro ajuste modelo/categorização, depois API, depois UI.
- Não remova o histórico detalhado; ele é importante para auditoria.
- Seja explícito nos comentários/nomes de funções para alguém lendo o código entender rapidamente o que é "evento produtivo" vs "evento operacional".

Ao final, faça um resumo das mudanças:

1. Como o evento agora é classificado internamente (campos/enum/booleans usados).
2. Quais parâmetros novos a API de histórico aceita.
3. Como o usuário alterna entre as visões Detalhada e Produtiva na UI.
4. Quais tipos de eventos entram em cada visão (produtivo vs operacional).

