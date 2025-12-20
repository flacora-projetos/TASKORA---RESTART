# Codex 5.1 — Turbinar Módulo **Equipe (Times)** no Taskora (UI + UX + métricas úteis)

## Contexto
O módulo **Equipe** hoje está funcional, mas ainda parece “lista de pessoas + dashboard comprido”. Quero transformar em um **painel operacional**: hierarquia clara, ações rápidas e métricas que ajudam a decidir (sem perfumaria).

Use o que já existe no projeto (componentes, estilo, endpoints e caches). **Não reescreva do zero.**

---

## Objetivo (resultado esperado)
1) A tela de Equipe deixa de ser “rolagem infinita” e vira **3 áreas claras**.
2) KPIs viram **clicáveis e acionáveis**.
3) Gráficos e listas ficam **compactos, legíveis e úteis**.
4) Cards por pessoa viram **mini-cockpits** + drill-down.
5) Nada de métricas vaidade ou ranking tóxico.

---

## Tarefas

### 1) Reestruturar a tela em **abas**
Na rota/página atual de Equipe, separar em Tabs:
- **Visão do time** (Overview)
- **Pessoas**
- **Administração** (cadastro/edição/ativar/arquivar)

**Critério:** cada aba deve carregar rápido e não exigir scroll gigante.

---

### 2) Visão do time (Overview) — melhorar hierarquia + ação
#### 2.1 KPIs (cards)
Manter 4–6 cards essenciais (ex.: Horas registradas, Tarefas concluídas, WIP, Bloqueadas, Atrasadas, Entregas sem horas).

**Melhorias obrigatórias:**
- Exibir **delta vs período anterior** (ex.: +12% / −8%) quando fizer sentido.
- Mostrar **estado visual** (semáforo discreto) para Atrasadas/Bloqueadas/Entregas sem horas.
- Card é **clicável** → abre uma lista filtrada (dentro do módulo Equipe via drawer/modal) OU redireciona para Tarefas com filtros aplicados.

#### 2.2 Gráficos
- Corrigir/repaginar “Horas por pessoa” para não ficar com área gigante vazia.
- Implementar visual de **lista de barras** (Top 5 + botão “Ver todos”).
- “Horas por cliente”: mostrar **% do total** e agrupar em “Top 5 + Outros” se passar de 5.

#### 2.3 Listas úteis
- “Últimas entregas do time” e “Riscos do dia”: mostrar **5 itens** + “Ver tudo”.
- Em “Riscos do dia”, agrupar por tipo (Atrasadas / Bloqueadas antigas / Sem horas) e ordenar por severidade.
- Adicionar ações rápidas quando possível: **Abrir tarefa**, **Atribuir**, **Marcar como resolvido** (se existir estado apropriado).

#### 2.4 Empty/Loading states
- Se tiver 1 pessoa só, adaptar o gráfico “Horas por pessoa” para layout compacto.
- Se não houver horas/tarefas no período, mostrar texto útil + CTA (“Ajustar período”, “Criar tarefa”, etc.).

---

### 3) Pessoas — cards por membro + drill-down
Criar uma aba **Pessoas** com grid de cards por membro contendo:
- Horas no período (com delta)
- WIP atual
- Concluídas + % no prazo
- Bloqueadas / Atrasadas
- Últimas 3 tarefas (clicáveis)
- Alertas discretos (ex.: “Sem horas registradas”, “WIP alto”, “Bloqueio antigo”)

Ao clicar no card, abrir **Drawer/Sidepanel Perfil do Membro** com:
- Resumo (cards pequenos)
- Distribuição de horas por cliente/projeto (Top 5)
- Tarefas recentes (lista filtrável)
- Pendências críticas (overdue + blocked)

---

### 4) Administração — mover e simplificar
Mover a seção de “Cadastro de integrantes” para a aba **Administração**.
- Remover botões duplicados de “Adicionar membro” (deixar 1 ponto principal)
- Manter ações existentes (editar/arquivar/ativar)
- Manter filtros (Ativos/Inativos/Todos)

---

## Implementação (como fazer sem inventar moda)
1) Localize a página/componente do módulo Equipe no `apps/web` (rota “Equipe/Times”).
2) Reaproveite componentes de UI existentes (Card, Tabs, Button, Drawer/Modal, Badge/Chip, Skeleton).
3) Reaproveite a lógica de filtros de período já existente (Hoje / 7d / 30d / Mês / custom).
4) Preferir **não criar endpoint novo**. Use os dados já carregados (tarefas + horas) e derive métricas no front.
   - Se faltar dado (ex.: time entries por membro), aí sim: proponha e implemente um endpoint mínimo no `apps/api` para “team overview” e “member drill-down”.
5) Garantir consistência visual com o tema atual (sidebar verde + topo). Ajustes pequenos ok (spacing/contraste), sem redesign geral.

---

## Qualidade / Aceite
- Tela de Equipe agora tem Tabs funcionais.
- KPIs são clicáveis e levam a uma lista filtrada.
- “Horas por pessoa” não fica vazio/estranho e funciona com 1 ou N membros.
- “Últimas entregas” e “Riscos do dia” aparecem compactos (Top 5 + ver tudo).
- Aba Administração isolada (sem misturar com Overview).
- Responsivo em desktop (≥ 1024px) e aceitável em 768px.

---

## Testes e checagens
- Adicionar pelo menos 1 teste de UI (ou equivalente no padrão do repo) garantindo:
  - Tabs renderizam
  - Aba Administração não aparece dentro da Visão do time
  - Clique em KPI dispara navegação ou abre painel filtrado
  - VERIFICAR SE TODOS AS FILTRAGENS DE MEBROS ESTÃO FUNCIONANDO, NOTEI QUE AS HORAS REGISTRADAS NÃO ESTÃO APARECENDO.

---

## Entrega
- Faça commits lógicos (ou equivalente na sua saída):
  1) Tabs + layout
  2) KPIs clicáveis + deltas
  3) Pessoas + drawer perfil
  4) Administração separada
  5) testes

Ao final, responda com:
- arquivos alterados
- prints/descrição do comportamento
- qualquer decisão tomada (ex.: quando não havia dado suficiente)

