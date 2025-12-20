# Módulo de Tarefas – Plano de UX

## Objetivo
Criar uma experiência única para o time acompanhar e executar tarefas por cliente, responsável e plataforma, usando linguagem amigável, visual elegante e sem jargões técnicos.

## Princípios
- **Linguagem humana**: textos curtos (“Quem cuida?”, “Pra quando?”) e nada de termos de desenvolvedor.
- **Visual alinhado ao dashboard**: cards brancos com bordas suaves, tons de verde profundo e realces em terracota.
- **Fluxo compacto**: filtrar → entender prioridades → agir sem sair da tela → opcionalmente visualizar como quadro.

## Roadmap

### 1. Fundação do módulo
- Hero curto com resumo “O que precisa sair do forno hoje?”.
- Cards rápidos: “Hoje”, “Semana”, “Atrasadas” com contadores.
- Filtros principais no topo:
  - Responsável (dropdown com foto/cores dos membros).
  - Cliente (auto complete).
  - Plataforma (Google, Meta, GA4, Outros).
  - Tipo de tarefa (criativos, otimizações, relatórios, etc.).
  - Status (backlog, em andamento, aguardando cliente, concluída).
  - Períodos rápidos: Hoje, Esta semana, Este mês, Últimos 7 dias, Últimos 30 dias, Custom.

### 2. Experiência de execução
- Lista padrão em formato tabela:
  - Colunas: Tarefa, Cliente, Responsável, Plataforma (com ícones), Prazo, Status/Prioridade.
  - Chips coloridos para prioridade e badges para plataforma.
- Quick actions:
  - Botões inline “Concluir”, “Precisa revisão”, “Reagendar”.
  - Drag para mover a tarefa entre estados (se possível).
- Overlay lateral (“modo Focus”) ao clicar na tarefa: brief, anexos, timeline curta, CTA “Registrar horas”/“Enviar arquivos”.
- Campo de nota rápida (“Adicionar atualização”) com histórico cronológico.

### 3. Filtros avançados e busca
- Barra de busca global com auto complete por cliente ou título da tarefa.
- “Filtros salvos” (ex: “Meus clientes”, “Urgente”, “Meta R$10k+”) acessíveis via dropdown.
- Botão “Limpar filtros” sempre visível.

### 4. Visuais adicionais
- **Modo Kanban opcional**:
  - Toggle “Lista / Quadro” no topo.
  - Colunas padrão: Backlog, Em andamento, Aguardando cliente, Concluída.
  - Cartões mostram cliente, responsável, plataformas e prazo. Arrastar altera o status.
- **Heatmap / gráfico**:
  - Pequeno gráfico exibindo tarefas concluídas por dia/responsável, para identificar gargalos.

### 5. Integrações e detalhes finais
- Botões “Criar tarefa” sempre disponíveis (abre modal enxuto com campos essenciais).
- Notificações discretas (toast “Prazo em 24h”).
- Links cruzados para ficha do cliente ou perfil do responsável.
- Mensagens de vazio simpáticas (“Nada por aqui. Que tal criar a próxima tarefa?”).

## Próximos passos sugeridos
1. Prototipar a lista com filtros e cards rápidos.
2. Definir o fluxo de quick actions e modal de criação.
3. Implementar o toggle Lista ↔ Kanban.
4. Adicionar gráficos/heatmap conforme necessidade do time.


## 2025-11-19 - Status Backlog
- Backend concluido para a fase de fundacao: o repositorio `tasks-repository` ganhou o metodo `listAll(orgId)` e a API expoe `GET /tasks/overview` consolidando todas as tarefas em um unico payload.
- O endpoint retorna cards Hoje/Semana/Atrasadas, lista principal com cliente/projeto/responsaveis/plataformas/checklist e filtros por status, responsavel, cliente, plataforma, projeto e periodos rapidos/customizados.
- Os filtros recebem as opcoes ja prontas (clientes ativos, membros do time ativos, projetos nao arquivados e catalogo de plataformas) e o payload inclui metadados `metadata.appliedFilters` para sincronizar a UI.
- Proximo passo: construir a pagina `/tasks` seguindo o hero e os cards planejados, consumindo o novo endpoint.


## 2025-11-19 - Status Frontend Fase 1
- Pagina `/tasks` criada com hero, cards Hoje/Semana/Atrasadas, filtros principais (status/tipo/responsavel/cliente/projeto/plataforma/per?odo/busca) e tabela principal seguindo o layout planejado.
- Componentes consomem `GET /tasks/overview`, exibem badges de prioridade, progresso do checklist e chips de plataforma; AppSidebar libera o link.
- Proxima etapa: quick actions (concluir/reagendar), overlay Focus e preparo do toggle Lista/Kanban.


## 2025-11-19 - Status Experi?ncia de execu??o
- Quick actions prontas na vis?o em tabela (Concluir, Precisa revis?o, Reagendar com date picker) e conectadas ao endpoint `PUT /projects/:projectId/tasks/:taskId`.
- Painel Focus lateral implementado com fetch de detalhes, checklist completo, timeline e campo "Adicionar atualiza??o" que salva na descri??o com carimbo.
- Estado de reschedule/feedback reaproveitado entre lista e Focus, garantindo UX cont?nua; pr?ximas entregas: quick actions adicionais (Precisa revis?o -> timeline), modal de cria??o e prepara??o do modo Kanban.


## 2025-11-19 - Status Cria??o r?pida
- Bot?o "Criar tarefa" adicionado ? hero e modal funcional publicado (campos essenciais + multi-respons?veis) salvando direto via `/projects/:projectId/tasks`.
- Ap?s o POST o overview ? recarregado e o Focus j? permite as quick actions; seguimos agora para quick actions adicionais (ex.: timeline) e prepara??o do modo Kanban.

## 2025-11-25 - Status Timeline + Focus edicao
- Quick actions (status/revis?o/reagendamento) agora registram eventos no timeline do cliente com metadados da tarefa, liberando o rastreio de opera??es antes de evoluir para Kanban.
- O painel Focus ganhou o bloco de edi??o (titulo, respons?veis, prazo e status) com multi-select e salvamento inline, mantendo feedbacks e reaproveitando o cache de detalhes.
- Pr?ximos passos: usar esse mesmo payload para preparar o toggle Lista/Kanban e estender as quick actions (drag/drop, prioridades manuais) sem perder o hist?rico no timeline.

## 2025-11-26 - Status UX Focus
- Quick actions e a tabela agora destacam tarefas concluidas (linha esverdeada + botao travado) para sinalizar o fim do fluxo mesmo antes do modo Kanban.
- Retiramos o checklist da lista e do Focus ate termos esse campo nos formularios, mantendo brief + timeline como fontes principais.
- O modal de criacao passou a exibir o cliente junto do projeto selecionado para evitar confusao quando ha projetos com nomes parecidos.

## 2025-11-27 - Status Focus completo e horas
- API passou a aceitar projectId no update de tarefas e move automaticamente as entradas de horas para o novo projeto; tambem adotamos o helper dateInputToSaoPauloISOString para normalizar prazos.
- O painel Focus agora cobre a edicao integral (titulo, responsaveis, projeto, prazo, status e brief), exibe o total de horas, registra notas e permite excluir a tarefa.
- A tabela trouxe chips de horas e botao Modo Focus por linha; as quick actions ganharam seletor de status e delete, alem do CTA para registrar horas sem sair da lista.
- Lances de horas aceitam qualquer valor de minutos, com o formato hh:mm reutilizado em todo o modulo (Focus, tabela, cards do dashboard).
- Proximo alvo do roadmap: preparar o toggle Lista/Kanban reaproveitando os novos metadados e manter o modo Focus como painel de edicao unico.
