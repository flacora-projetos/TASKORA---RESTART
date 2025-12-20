# Codex 5.1 — Melhorar o **Calendário / Planejamento** (acabar com scroll infinito + UX operacional)

## Contexto
A tela de **Calendário / Planejamento semanal de tarefas** está útil, mas virou “scroll infinito”. Tem muita informação empilhada, e o usuário perde o que é importante.

**Meta:** transformar em um calendário operacional: navegação clara por semana, filtros sempre à mão, colunas legíveis e backlog “fora da semana” controlado.

**Regra:** não reescrever do zero. Reaproveitar UI/estilo/componentes existentes.

---

## Objetivos (resultado esperado)
1) **Sem scroll infinito** para o uso diário.
2) Header/filtros **sticky** (sempre visíveis).
3) Semana navega por **Anterior / Atual / Próxima** (e seletor de data opcional).
4) Colunas do Kanban semanal não podem “explodir” verticalmente sem controle.
5) “Fora da semana” vira **colapsável** + com busca e/ou paginação.

---

## Tarefas

### 1) Layout: separar em seções claras
Na página do calendário, reorganizar em 3 blocos:
- **(A) Header Sticky**: título + período exibido + seletor de projeto + chips de status + navegação de semana
- **(B) Grade da semana**: 7 colunas (seg–dom) com cards
- **(C) Fora da semana**: backlog colapsável

**Sticky:** manter (A) fixo no topo ao rolar dentro do conteúdo.

---

### 2) Navegação de semana (sem infinito)
- Garantir botões: **Semana anterior / Semana atual / Próxima semana**
- Mostrar claramente o range: `15 dez – 21 dez`.
- Opcional (se fácil): **date picker** para ir direto a uma semana.

**Importante:** ao trocar semana, a página não deve aumentar scroll; é uma troca de dataset.

---

### 3) Contenção da altura das colunas (o grande vilão)
Cada coluna do dia deve ter:
- Header do dia + contadores (ex.: total, atrasadas, concluídas)
- Lista de cards dentro de um container com **altura máxima** e **scroll interno**
- Botão “**Ver mais**”/“Expandir” para abrir um Drawer/Modal com a lista completa daquele dia (com filtros).

**Aceite:** se um dia tem 30 tarefas, ele não empurra o restante da página para baixo de forma absurda.

---

### 4) Cards mais compactos e úteis
Hoje os cards parecem altos. Ajustar para modo compacto:
- Título (1–2 linhas com ellipsis)
- Cliente/Projeto (linha menor)
- Responsável (ou avatar)
- Status (chip)
- Prazo (e ícone se atrasado)

**Interação:** clique abre detalhes; actions rápidas (ex.: abrir tarefa, reatribuir, marcar done) se já existir no padrão do app.

---

### 5) “Fora da semana” (backlog) — colapsável + buscável
Transformar o bloco “Fora da semana” em um componente:
- Começa **colapsado** (mostra só um resumo: `X tarefas fora da semana` + `Y atrasadas`)
- Ao expandir:
  - Campo de busca
  - Filtros rápidos (ex.: atrasadas, sem data, alta prioridade)
  - Lista paginada ou Top 20 + “Carregar mais”

**Aceite:** a tela não vira um mural interminável; backlog é consultável sob demanda.

---

### 6) Performance: virtualização (se necessário)
Se a lista de cards por dia/backlog for grande, aplicar virtualização (ex.: `react-window` ou lib já usada no repo) **somente nas listas**, mantendo a UI igual.

---

## Implementação (passo a passo)
1) Localizar a página/componente do calendário em `apps/web` (provável rota `Calendario`/`Calendar`).
2) Identificar de onde vem o dataset (tarefas por data/semana) e como são aplicados os filtros.
3) Implementar:
   - Header sticky
   - Colunas com altura máxima + scroll interno
   - Drawer/Modal “Ver mais” por dia
   - Backlog “Fora da semana” colapsável + busca + paginação
4) Manter estilo visual atual (cores/spacing), só refinando legibilidade.

---

## Critérios de aceite (checklist)
- [ ] Não existe mais sensação de “scroll infinito” para navegar a semana.
- [ ] Filtros e navegação de semana ficam visíveis (sticky).
- [ ] Colunas não aumentam a página infinitamente (scroll interno + ver mais).
- [ ] “Fora da semana” vem colapsado e não domina a tela.
- [ ] Responsivo aceitável em 1024px e 768px.

---

## Testes
Adicionar ao menos 1 teste (no padrão do repo) cobrindo:
- Renderização do header + botões de semana
- Expandir/colapsar “Fora da semana”
- Ação “Ver mais” abre drawer/modal

---

## Entrega
No final, responda com:
- arquivos alterados
- breve descrição do novo comportamento
- screenshots (se sua ferramenta permitir) ou relato detalhado
- decisões tomadas (ex.: necessidade de virtualização)

