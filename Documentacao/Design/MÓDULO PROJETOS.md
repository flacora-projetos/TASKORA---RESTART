MÓDULO PROJETOS

Você é responsável por REFINAR o DESIGN VISUAL do MÓDULO DE PROJETOS do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO alterar lógica, dados, estados, rotas, textos ou comportamentos.
- NÃO modificar o funcionamento de “Modo Focus”, “Criar Tarefa” ou “Editar”.
- Foque exclusivamente em estética: layout, cores, espaçamento, hierarquia visual, tipografia e consistência com o restante da aplicação.

==================================================
🎯 CONTEXTO DA TELA PROJETOS

A página contém:
- Um hero/cabeçalho com título “Operação / Projetos”
- Um subtítulo explicando a função da tela
- Um botão “Novo projeto”
- Uma área de filtros: Status, Cliente, Busca
- Uma tabela/lista de projetos contendo:
  - Nome do projeto
  - Cliente
  - Status (Em andamento, Rascunho, Concluído, etc.)
  - Responsável
  - Período
  - Budget
  - Última atualização
  - Ações (Modo Focus, Criar tarefa, Editar, Arquivar, Ver tarefas)

O objetivo é deixar essa tela com aparência de SaaS premium, totalmente alinhada com a estética aplicada nos módulos Dashboard e Tarefas.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA VISUAL GERAL
- Usar o mesmo padrão do resto do app:
  - Cards/container: `rounded-xl`
  - Conteúdo interno: `bg-white` + `border border-gray-200`
  - Sombras: usar apenas `shadow-sm` se extremamente necessário
  - Fundo da página: cinza muito claro (algo próximo de `#F9FAFB`)
- Evitar misturar radius diferentes; tudo deve usar `rounded-xl`

2) HERO / CABEÇALHO
- Simplificar o gradiente do bloco verde superior:
  - Usar cor sólida da marca OU gradiente suave dentro da família do verde.
- Tipografia:
  - Título: `text-2xl font-semibold text-white`
  - Subtítulo: `text-sm text-white/80`
- Botão “Novo projeto”:
  - Deve ter alta hierarquia visual
  - Usar cor primária (verde petróleo) como botão principal
  - Bordas arredondadas (`rounded-lg` ou `rounded-full` depende do padrão do app)
  - Hover com leve escurecimento

3) ÁREA DE FILTROS
- Unificar os filtros em um único card:
  - `bg-white rounded-xl border border-gray-200 p-6`
- Organizar os inputs em **grid 2 ou 3 colunas**
- Labels:
  - `text-xs or text-sm text-gray-600`
- Campos de input:
  - usar estilos consistentes com outros módulos
- Campo de busca:
  - Deve ter ícone de lupa discreto e padding uniforme
- Botão “Limpar filtros”:
  - Estilo secundário (ghost ou link)

4) LISTA / TABELA DE PROJETOS
- Transformar a tabela em um “row card” mais moderno, com:
  - `bg-white`
  - `border border-gray-200`
  - `rounded-xl`
  - `p-4` ou `p-6`
  - `hover:bg-gray-50` para efeito visual
- Manter colunas bem definidas:
  - Projeto
  - Cliente
  - Status
  - Responsável
  - Período
  - Budget
  - Atualizado em
  - Ações

5) TAGS DE STATUS
- Padronizar TODOS os chips de status (Rascunho, Em andamento, Concluído):
  - `rounded-full`, `text-xs font-medium px-3 py-1`
  - Cores consistentes com o módulo Tarefas:
    - Concluído: verde suave
    - Em andamento: azul ou verde-escuro suave
    - Rascunho: cinza neutro
    - Arquivado/pendente: amarelo ou laranja (se necessário)
- Todas as tags devem seguir o mesmo estilo e tamanho.

6) AÇÕES (botões da tabela)
- Agrupar os botões de ação de forma limpa e consistente.
- Botões principais (Modo Focus, Criar tarefa):
  - usar estilo primário ou secundário claro
- Botões secundários (Editar, Arquivar, Ver tarefas):
  - estilo ghost/outline
- Evitar misturar estilos diferentes dentro de uma mesma linha

7) ESPAÇAMENTO ENTRE SEÇÕES
- Usar `mt-8` entre hero, filtros e tabela
- Dentro dos cards/tabela: `p-6` como padrão

8) TIPOGRAFIA
- Título do módulo: `text-2xl font-semibold`
- Títulos das seções intermediárias: `text-lg font-semibold`
- Textos explicativos: `text-sm text-gray-600`
- Sub-informações (datas, budgets, labels pequenos): `text-xs text-gray-500`

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar APENAS o visual do módulo Projetos aplicando TODAS as diretrizes acima.
2. NÃO alterar lógica de clique/mudança de status/abertura de modal.
3. Garantir hierarquia visual coerente:
   - Hero
   - Filtros
   - Lista de projetos

==================================================
🚫 NÃO FAÇA

- Não excluir nenhum dado ou coluna.
- Não renomear funções/props/hooks.
- Não alterar textos.
- Não modificar navegação/menus.
- Não criar novas cores fora da paleta.

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do módulo Projetos refatorado com:
  - Layout mais limpo, elegante e consistente.
  - Filtros organizados em card.
  - Tabela de projetos com visual de SaaS premium.
  - Mesma funcionalidade atual, com design refinado.

Comece agora aplicando essas melhorias ao arquivo do módulo Projetos.
