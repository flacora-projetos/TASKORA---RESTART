MODULO TAREFAS

Você é responsável por REFINAR o DESIGN VISUAL do MÓDULO DE TAREFAS do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO altere lógica, estados, hooks, rotas, requisições ou textos.
- NÃO mude o comportamento do modo Focus (modal que abre ao clicar numa tarefa).
- Foque SOMENTE em layout, espaçamento, hierarquia visual, cores e estilos.

==================================================
🎯 CONTEXTO DA TELA

Esta tela de Tarefas tem:
- Um hero/cabeçalho do módulo: “O que precisa sair do forno hoje?”
- 3 cards-resumo: Hoje / Esta semana / Atrasadas
- Um bloco de Filtros principais (cliente, projeto, tipo, status, datas, busca)
- Chips de status global (Backlog, A fazer, Em andamento, Bloqueada, Em revisão, Concluída)
- Lista de tarefas em formato de tabela/lista, mostrando:
  - Título da tarefa
  - Cliente
  - Responsável
  - Plataforma (Meta Ads, Google Ads, GA4 etc.)
  - Prazo
  - Status
  - Ações (Concluir, Modo Focus, Excluir, etc.)

Quero que essa tela fique com cara de SaaS premium, bem alinhada visualmente com o dashboard.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA GERAL
- Usar as mesmas decisões visuais do dashboard:
  - Todos os cards principais com `rounded-xl`.
  - Cards de conteúdo com `border border-gray-200` e `bg-white`.
  - `shadow-sm` só se for realmente necessário em blocos importantes.
  - Fundo da página em cinza bem claro (ex.: algo próximo de `#F9FAFB`).

2) HERO DO MÓDULO DE TAREFAS
- Simplificar o fundo:
  - Usar cor sólida escura da marca OU um gradiente suave dentro da família de verde (sem contraste exagerado).
- Tipografia:
  - Título: `text-2xl font-semibold text-white`.
  - Descrições/subtítulo: `text-sm ou text-base text-white/80`.
- Botões “Atualizar agora” e “Criar tarefa”:
  - Definir um botão primário (cor principal da marca) e um secundário (outline ou neutro).
  - Alinhar melhor à direita ou em um grupo bem organizado.
- Deixar a informação de período (intervalo de datas) visualmente clara e discreta.

3) CARDS-RESUMO (HOJE / ESTA SEMANA / ATRASADAS)
- Layout consistente entre os três:
  - `bg-white rounded-xl border border-gray-200 p-4 ou p-6`.
- Tipografia:
  - Número principal grande: `text-3xl font-semibold`.
  - Rótulo/descrição: `text-sm text-gray-500`.
- Espaçamento entre eles com grid ou flex bem distribuído, sem parecer apertado.

4) BLOCO DE FILTROS PRINCIPAIS
- Transformar todos os filtros em UM card único:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Organizar os inputs em grid (2 ou 3 colunas em desktop) para ficar mais limpo.
- Labels dos campos:
  - `text-xs ou text-sm text-gray-600`.
- Botões de período (Hoje, Esta semana, Últimos 7 dias, Últimos 30 dias):
  - Usar estilo de “segmented control”:
    - Selecionado: fundo com cor primária leve + texto na cor primária.
    - Não selecionado: fundo neutro + borda leve.
- Incluir um botão “Limpar filtros” com estilo de link ou botão secundário discreto.

5) CHIPS / TAGS DE STATUS E PLATAFORMA
- Padronizar TODOS os chips (status, plataforma, tipo etc.):
  - `rounded-full`
  - `text-xs font-medium`
  - `px-3 py-1`
- Paleta de status:
  - Concluída: verde suave.
  - A fazer / Backlog: cinza/neutro.
  - Em andamento: azul.
  - Bloqueada: vermelho/laranja.
  - Em revisão: amarelo.
- Garantir contraste adequado (texto sempre legível).

6) LISTA DE TAREFAS
- Cada linha de tarefa deve parecer um “row card” limpo:
  - espaço interno consistente (ex.: `py-4`).
  - `hover:bg-gray-50` para dar feedback ao passar o mouse.
- Colunas bem definidas:
  - Título da tarefa (com maior destaque, `text-sm ou text-base font-medium`).
  - Cliente.
  - Responsável (com avatar ou iniciais, se já existir).
  - Plataforma (com chips).
  - Prazo.
  - Status (chip).
- Ações como “Concluir”, “Modo Focus”, “Excluir”:
  - Agrupar no final da linha ou numa coluna específica de ações.
  - Botão principal (ex.: “Concluir”) com estilo mais forte.
  - Botões secundários com estilo outline/ghost.

7) CHIPS DE STATUS GERAL (Backlog, A fazer, Em andamento, etc.)
- Deixar esses chips visualmente alinhados com os demais:
  - `rounded-full text-xs font-medium px-3 py-1`.
- Chip selecionado deve ter estilo claro:
  - fundo mais forte e texto com cor adequada (geralmente branco).
  - chips não selecionados com fundo neutro.

8) ESPAÇAMENTO ENTRE SEÇÕES
- Usar um padrão consistente:
  - `mt-8` entre hero, cards-resumo, filtros e lista.
- Dentro de cada card, usar `p-6` como padrão (quando fizer sentido).

9) TIPOGRAFIA GERAL
- Títulos de seção (ex.: “Status geral”): `text-lg font-semibold`.
- Textos explicativos: `text-sm text-gray-600`.
- Informações de detalhe (datas, notas curtas): `text-xs text-gray-500`.

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar o arquivo do Módulo de Tarefas aplicando TODAS as regras acima.
2. Não alterar o comportamento do modal Focus; apenas garantir que o botão/link que abre o Focus esteja visualmente claro, organizado e com o estilo correto.
3. Garantir que a hierarquia visual da tela seja:
   - Hero do módulo
   - Cards-resumo
   - Filtros
   - Status geral (chips)
   - Lista de tarefas

==================================================
🚫 NÃO FAÇA

- Não remover nenhuma informação atual da tela.
- Não renomear componentes, props, hooks, nem mudar lógica.
- Não alterar textos, rótulos ou copy.
- Não criar novas cores fora da paleta (primária, secundária, neutros e alertas).
- Não mexer na sidebar ou navegação global.

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do Módulo de Tarefas refatorado com:
  - Layout mais limpo e consistente.
  - Cards e filtros com cara de SaaS premium.
  - Chips e status visuais padronizados.
  - Mesma funcionalidade atual, apenas com design mais profissional.

Comece agora aplicando essas melhorias ao arquivo do módulo de Tarefas.
