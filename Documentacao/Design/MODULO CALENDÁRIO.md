MODULO CALENDÁRIO

Você é responsável por REFINAR o DESIGN VISUAL do MÓDULO DE CALENDÁRIO – PLANEJAMENTO SEMANAL DE TAREFAS do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO alterar lógica, estados, hooks, rotas ou requisições.
- NÃO mudar comportamento dos filtros, da navegação de semanas, nem dos cliques nas tarefas.
- Foque SOMENTE em layout, espaçamento, hierarquia visual, paleta de cores, tipografia e consistência com os outros módulos (Dashboard, Tarefas, Projetos, Clientes, Equipe).

==================================================
🎯 CONTEXTO DA TELA

O módulo Calendário (visão semanal) contém:

1. Um HERO superior com:
   - Título: “Planejamento semanal de tarefas”.
   - Texto explicativo.
   - Informação de projeto atual (ex.: “Relatórios – Clientes Allgrotech”).
   - Informação da semana exibida (datas).
   - Fundo em gradiente (tons de laranja/verde).

2. Bloco de filtros e controles logo abaixo:
   - Select de Projeto.
   - Filtro “Status das tarefas” com chips (Todas, Backlog, A fazer, Em andamento, Bloqueada, Em revisão, Concluída).
   - Botões de navegação de semana: “Semana anterior”, “Semana atual”, “Próxima semana”.
   - Botão “Atualizar calendário”.

3. Grade de DIAS DA SEMANA (segunda a domingo):
   - Cada dia é um card com:
     - Label “Prazo + data”.
     - Contagem de tarefas no dia.
     - Se existirem tarefas, cada tarefa aparece como um pequeno card interno, com:
       - Título da tarefa.
       - Responsável.
       - Projeto/cliente.
       - Status (badge “Concluída”, “A fazer”, etc.).
       - Data/hora de atualização.

O objetivo é deixar essa tela com cara de “agenda operacional premium”, extremamente legível e coerente com o resto do sistema.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA GLOBAL
- Mesmos padrões dos outros módulos:
  - Fundo da página: cinza muito claro (próximo a `#F9FAFB`).
  - Cards: `bg-white rounded-xl border border-gray-200`.
  - Sombras apenas quando necessário (`shadow-sm` no máximo).
- Tipografia padrão:
  - Título da página: `text-2xl font-semibold`.
  - Subtítulos: `text-lg font-semibold`.
  - Textos de apoio: `text-sm text-gray-600`.
  - Detalhes (datas, rótulos pequenos): `text-xs text-gray-500`.

2) HERO “PLANEJAMENTO SEMANAL DE TAREFAS”
- Harmonizar o gradiente:
  - Usar cor sólida da marca OU gradiente suave dentro da mesma família (por exemplo apenas tons de laranja OU apenas tons de verde).
  - Evitar gradiente agressivo multicolorido.
- Conteúdo do hero:
  - Título em destaque: `text-2xl font-semibold text-white`.
  - Descrição em `text-sm text-white/80`.
  - Projeto atual e semana exibida organizados em linha ou em 2 colunas, sempre com boa legibilidade.
- Bordas:
  - `rounded-xl` em todo o hero para seguir o padrão de cards do app.

3) BLOCO DE FILTROS E CONTROLES
- Colocar os filtros/controles dentro de um card único logo abaixo do hero:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Organização:
  - Linha 1:
    - Select “Projeto” (com label) ocupando boa largura.
  - Linha 2:
    - “Status das tarefas” com chips em uma faixa horizontal.
  - Linha 3:
    - Navegação de semana (Semana anterior / atual / próxima) à esquerda.
    - Botão “Atualizar calendário” alinhado à direita.
- Chips de status:
  - Transformar todos em um “segmented control” consistente com o resto do app:
    - `rounded-full text-xs font-medium px-3 py-1.5`.
    - Estado selecionado: fundo com cor primária suave + texto na cor primária.
    - Estado não selecionado: fundo neutro (`bg-gray-100`) + texto `text-gray-600`.
- Botões de semana:
  - Estilo de botão secundário coerente (outline/ghost) com bordas arredondadas.
- Botão “Atualizar calendário”:
  - Botão primário na cor da marca.

4) GRADE DE DIAS DA SEMANA
- Cada dia da semana deve ser um card bem definido:
  - `bg-white rounded-xl border border-gray-200 p-4 ou p-5`.
  - Espaçamento entre os dias com `gap-4` ou `gap-6`.
- Layout da grade:
  - Em desktop, usar grid com 3 colunas (ou 4, se ficar confortável) para distribuir os dias.
  - Garantir que todos os cards de dia tenham a mesma altura mínima para aparência uniforme.

5) CONTEÚDO DE CADA DIA
- Cabeçalho do dia:
  - Legendinha “PRAZO” em `text-xs uppercase text-gray-500`.
  - Data (ex.: “Quarta-feira, 26 de nov.”) em `text-sm font-medium text-gray-800`.
  - Contador de tarefas do dia (`0 tarefas / 1 tarefa / x tarefas`) alinhado à direita ou abaixo, em `text-xs text-gray-500`.
- Quando não houver tarefas:
  - Exibir mensagem simples: “Sem tarefas com prazo neste dia.” em `text-sm text-gray-500`.
- Quando houver tarefas:
  - Cada tarefa como um mini-card interno:
    - `rounded-lg border border-gray-100 bg-gray-50 p-3 mt-2`.
    - Título da tarefa: `text-sm font-medium text-gray-800`.
    - Informações adicionais (responsável, cliente, atualizado em…) em `text-xs text-gray-500`.
    - Status como chip:
      - `rounded-full text-xs font-medium px-3 py-1`.
      - Cores consistentes com o módulo Tarefas (Concluída = verde suave, A fazer = neutro, Em andamento = azul, Bloqueada = vermelho/laranja, etc.).

6) INTERAÇÃO VISUAL
- `hover`:
  - Ao passar o mouse sobre uma tarefa, usar `hover:bg-gray-100` no mini-card.
  - Se houver clique para abrir Modo Focus ou detalhes, o feedback visual deve deixar isso claro (cursor pointer etc.).
- Não mudar o comportamento, apenas o feedback visual.

7) ESPAÇAMENTO ENTRE SEÇÕES
- Entre hero, filtros e grade de dias:
  - Usar `mt-8` ou `space-y-8`.
- Dentro dos cards:
  - Manter `p-6` em blocos grandes (filtros).
  - `p-4` ou `p-5` em cards de dia.

8) TIPOGRAFIA E HIERARQUIA
- Título do módulo (“Planejamento semanal de tarefas”) deve ser claramente o elemento mais forte do topo.
- Datas da semana exibida devem ser visíveis, porém não competir com o título.
- Nos cards de dia:
  - Data do dia com destaque moderado.
  - Título das tarefas com foco.
  - Demais informações em fonte menor.

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar APENAS o visual do Módulo Calendário (planejamento semanal de tarefas) aplicando todas as regras acima.
2. Manter exatamente a mesma lógica de filtros, navegação de semana e cliques de tarefa.
3. Garantir que o resultado final:
   - Pareça um painel de agenda semanal moderno.
   - Esteja visualmente alinhado com Dashboard, Tarefas, Projetos, Clientes e Equipe.
   - Tenha leitura fluida em telas grandes.

==================================================
🚫 NÃO FAÇA

- Não remover nenhum dia, tarefa, filtro ou botão.
- Não renomear componentes, props ou funções.
- Não alterar textos ou rótulos.
- Não mexer em rotas, hooks ou comportamento de clique.
- Não criar novas cores fora da paleta global (primária, secundária, neutros, cores de status).

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do Módulo Calendário (planejamento semanal) refatorado com:
  - Hero mais harmonizado.
  - Bloco de filtros limpo e organizado.
  - Grade de dias uniforme e legível.
  - Mini-cards de tarefas padronizados.
  - Nenhuma mudança de funcionalidade, apenas refinamento visual.

Comece agora aplicando essas melhorias ao arquivo do Módulo Calendário.
