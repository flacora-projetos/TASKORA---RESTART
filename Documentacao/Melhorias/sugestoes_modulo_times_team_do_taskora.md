# Sugestões para turbinar o Módulo **Times** (Team)

Hoje ele parece “lista de pessoas”. A meta é virar um **painel de operação**: *quem está fazendo o quê, quanto tempo está indo, onde está travando e o que está em risco* — sem enfeite.

---

## Princípio (pra não virar dashboard inútil)
**Menos vaidade, mais decisão.** Tudo que entrar aqui precisa responder pelo menos uma:
- O que está **em risco**?
- Onde está o **gargalo**?
- Quem está **sobrecarregado** ou **ocioso**?
- O time está **registrando horas** direito?
- Estamos entregando **no prazo**?

---

## Layout recomendado (3 abas)

### 1) Visão do Time (Overview)
**Topo**
- Seletor de período (Hoje / 7d / 30d / Mês / custom)
- Filtros: Cliente, Projeto, Squad/Role, Responsável

**Cards (4–6, no máximo)**
1. **Horas registradas** (período) + tendência vs período anterior
2. **Tarefas concluídas** + % no prazo
3. **WIP (em andamento)** + “estouro” (WIP acima do limite)
4. **Bloqueadas** (quantas + quanto tempo bloqueadas)
5. **Atrasadas** (overdue) + impacto (por prioridade)
6. **Horas sem tarefa vinculada** (se existir) ou **tarefas concluídas sem horas**

**Gráficos (2–3 no máximo)**
- **Horas por pessoa** (barra)
- **Horas por cliente/projeto** (barra empilhada)
- **Fluxo de status** (pizza/stack: todo/doing/blocked/review/done)

**Lista útil (sempre aparece no final)**
- “**Últimas entregas do time**” (últimas 10 tarefas concluídas)
- “**Riscos do dia**” (tarefas atrasadas + bloqueadas há mais de X dias)

---

### 2) Pessoas (Cards por membro)
Grid de cards (bem objetivo):
- Nome + papel (role)
- **Horas no período** (+ vs anterior)
- **WIP atual** (tarefas doing/review)
- **Concluídas** (período) + % no prazo
- **Bloqueadas** (quantas)
- **Últimas 5 tarefas** (clicável)
- Alertinhas inteligentes:
  - “**Sobrecarregado**” (WIP alto + overdue)
  - “**Ocioso**” (baixo WIP + poucas entregas)
  - “**Sem registro de horas**” (tarefas concluídas sem time log)

Ao clicar no card → abre **drawer/perfil do membro**.

---

### 3) Perfil do Membro (drill-down)
Seções:
- **Resumo** (cards pequenos: horas, concluídas, WIP, bloqueadas, overdue)
- **Linha do tempo** (últimas ações/tarefas)
- **Distribuição de horas** (por cliente/projeto/tipo de tarefa)
- **Tarefas recentes** (com filtros)
- **Pendências críticas** (overdue + blocked)
- **Conformidade de horas** (tarefas concluídas sem registro)

---

## Métricas que realmente importam (sem firula)
- **Horas registradas** (dia/semana/mês)
- **Horas por cliente/projeto** (pra enxergar onde o tempo some)
- **Entrega no prazo** (% on-time)
- **Lead time / Cycle time** (tempo do “criada” → “done”)
- **WIP** (quantas tarefas ativas por pessoa)
- **Bloqueio** (quantidade + idade do bloqueio)
- **Backlog aging** (tarefas paradas há muito tempo)
- **Missing time** (tarefas concluídas sem horas)

> Se você quiser 1 índice único (pra card):
**Índice de Previsibilidade** = (% on-time) ajustado por (bloqueios e overdue).

---

## “Insights automáticos” (sem IA viajada)
Uma caixinha no topo: **Insights da Semana**
- “X tarefas estão bloqueadas há mais de 3 dias — gargalo em aprovação.”
- “Fulano está com WIP 12 e 5 atrasadas — redistribuir tarefas.”
- “Equipe concluiu 28 tarefas, mas 9 ficaram sem horas — risco de subestimar esforço.”

---

## Coisas que eu NÃO colocaria (pra não virar rede social)
- Ranking de “quem fez mais” sem contexto
- Badges/pontinhos/emoji demais
- Métricas que incentivam velocidade burra (ex.: só contar quantidade)

---

## Como implementar (incremental, sem reescrever o app)

### Fase 1 (MVP — impacto imediato)
- Overview com **cards essenciais** + gráfico “horas por pessoa”
- Grid de **cards por membro** com “últimas tarefas”
- Alertas simples: overdue, blocked, missing time

### Fase 2 (Operação madura)
- Perfil do membro (drawer) + distribuição de horas por cliente/projeto
- Cycle time / Lead time
- Filtro avançado por cliente/projeto/squad

### Fase 3 (Inteligência e planejamento)
- Capacidade (horas/semana) vs demanda (WIP + prazos)
- Sugestão automática de redistribuição
- Metas por sprint/semana (sem virar microgerenciamento)

---

## Dados necessários (o mínimo)
- Tasks: status, assignee, createdAt, updatedAt, dueDate, priority, clientId, projectId
- Time entries: memberId, taskId (ideal), minutes, date
- (Opcional) Log de transições de status pra cycle time perfeito

---

## Texto de venda interno (pra time adotar)
“Times não é pra vigiar ninguém. É pra **tirar ruído** e **proteger o time**: a gente enxerga gargalo cedo, distribui melhor, e o esforço vira **prova de valor**.”
