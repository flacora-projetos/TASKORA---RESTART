MODULO CLIENTES GERAL

Você é responsável por REFINAR o DESIGN VISUAL do MÓDULO DE CLIENTES (VISÃO GERAL) do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO alterar lógica, estados, hooks, rotas, requisições ou textos.
- NÃO mexer no funcionamento dos filtros, links ou botões (ex.: abrir visão 360, abrir detalhes, etc.).
- Foque SOMENTE em: layout, espaçamento, cores, hierarquia visual, tipografia, organização visual da lista.
- A funcionalidade deve permanecer idêntica; apenas o visual deve ser melhorado.

==================================================
🎯 CONTEXTO DA TELA

Esta tela contém:
- Cabeçalho do módulo de Clientes (hero simples no topo, com título e botão de ação).
- Bloco de filtros (status, tipo, plataforma, período, etc.).
- Uma LISTA LONGA de clientes, em formato de “tabela/lista vertical”, com muitas linhas.
  Cada cliente mostra informações como:
  - Nome do cliente
  - Segmento / tipo
  - Plataformas conectadas (Google, Meta, GA4 etc.)
  - Períodos de análise
  - Investimento / leads / custo por lead (CPL) / outras métricas por canal
  - Links para abrir visão 360, detalhes, etc.

Quero que essa tela tenha cara de CRM/BI de agência premium: muito legível, organizada e coerente com o design do Dashboard, Tarefas e Projetos.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA GERAL
- Usar o mesmo padrão de design do resto do app:
  - Fundo da página em cinza claro (ex.: algo próximo de `#F9FAFB`).
  - Cards e grandes blocos com `bg-white`, `rounded-xl`, `border border-gray-200`.
  - Evitar sombras fortes; se usar, manter no máximo `shadow-sm`.
- Manter o mesmo estilo de tipografia global (títulos, textos, legendas) adotado nos outros módulos.

2) HERO / CABEÇALHO DO MÓDULO CLIENTES
- Criar um pequeno hero alinhado com os outros módulos:
  - Título (ex.: “Clientes”) com `text-2xl font-semibold`.
  - Subtítulo/resumo da função da tela com `text-sm text-gray-600`.
  - Botão principal (ex.: “Novo cliente” ou ação equivalente) à direita, com cor primária (verde da marca) e estilo consistente com os outros módulos.
- Se já existir uma barra colorida no topo, garantir que:
  - O gradiente/cor seja consistente com o resto do produto (mesma família de verdes).
  - Texto no hero tenha contraste perfeito (title e descrição claramente legíveis).

3) BLOCO DE FILTROS
- Colocar TODOS os filtros dentro de um card único:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Organizar os campos de filtro (status, tipo, plataforma, período, etc.) em GRID:
  - 2 ou 3 colunas em desktop para reduzir altura.
- Labels de filtros:
  - `text-xs ou text-sm text-gray-600`.
- Inputs/selects:
  - Estilo consistente com o resto do app (bordas arredondadas, altura padrão).
- Campo de busca com ícone de lupa discreto e padding consistente.
- Botão “Aplicar” / “Buscar” deve ser claramente identificado como ação principal do card de filtros.
- Se existir “Limpar filtros”, usar estilo de link ou botão ghost, discreto.

4) LISTA DE CLIENTES — ESTRUTURA GERAL
- Deixar cada linha de cliente com aparência de “row card” moderno:
  - `bg-white`
  - `border border-gray-200`
  - `rounded-xl`
  - `p-4 ou p-5`
  - Margem inferior padrão (ex.: `mb-4`) entre os cards de clientes.
  - `hover:bg-gray-50` para dar feedback ao passar o mouse.
- A lista inteira deve ficar dentro de um container central com largura máxima definida (ex.: `max-w-6xl` ou semelhante).

5) LISTA DE CLIENTES — CONTEÚDO DE CADA CARD
- Reorganizar visualmente cada cliente para melhorar a leitura:
  - Topo do card:
    - Nome do cliente em destaque: `text-base or text-lg font-semibold`.
    - Segmento/descrição curta logo abaixo, `text-xs ou text-sm text-gray-500`.
  - Colunas internas em layout de GRID:
    - Coluna A: status do cliente, tipo, tags de categoria.
    - Coluna B: plataformas conectadas (Google Ads, Meta Ads, GA4, etc.) com chips consistentes.
    - Coluna C: métricas principais (Investimento total, Leads, CPL ou outro indicador-chave).
    - Coluna D: ações (ex.: abrir visão 360, ver detalhes, etc.).
- Manter o conteúdo que já existe, apenas reorganizando em grid/flex para melhorar a visualização.

6) TAGS / CHIPS (STATUS, PLATAFORMAS, ETC.)
- Padronizar TODAS as tags de cliente:
  - `rounded-full`
  - `text-xs font-medium`
  - `px-3 py-1`
- Cores:
  - Status ativo: verde suave.
  - Status em risco / atenção: amarelo/laranja suave.
  - Status inativo / pausado: cinza neutro.
  - Plataformas (Google, Meta, GA4, etc.): mesma paleta usada em outros módulos (ex.: Google em azul, Meta em roxo, GA4 em outro tom diferenciado), mas sempre em versão suave.
- Evitar múltiplos estilos de chip na mesma tela; tudo deve parecer parte do mesmo sistema.

7) MÉTRICAS (INVESTIMENTO, LEADS, CPL, ETC.)
- Agrupar as principais métricas em um mini-bloco visualmente organizado:
  - Usar tipografia consistente:
    - Label: `text-xs text-gray-500`.
    - Valor: `text-sm ou text-base font-medium`.
  - Espaçamento vertical pequeno e consistente entre linhas de métricas.
- Se a linha tiver muitas métricas, usar duas colunas internas para quebrar a leitura (sem alterar os dados).
- Cores de números:
  - Valores positivos/ok: texto normal.
  - Valores críticos (ex.: CPL muito alto, status vermelho): pode usar `text-red-500` de forma pontual, mas sem poluir a tela.

8) AÇÕES POR CLIENTE
- Agrupar todas as ações (ex.: “Visão 360”, “Ver projetos”, “Ver tarefas”, etc.) em uma área específica do card, geralmente à direita ou no rodapé do card com um alinhamento claro.
- Estilos:
  - Ação principal (ex.: “Visão 360 do cliente”): botão com estilo mais forte ou cor primária.
  - Outras ações: estilo secundário (outline/ghost) com o mesmo tamanho e padding.
- Evitar ter botões muito diferentes dentro do mesmo card (mesma altura, mesmo border-radius).

9) ESPAÇAMENTO E HIERARQUIA
- Usar `mt-8` entre:
  - hero → filtros
  - filtros → lista de clientes.
- Dentro de cada card de cliente:
  - `p-4 ou p-5` de padding interno.
  - Espaçamento coerente entre título, tags, métricas e ações.

10) TIPOGRAFIA GLOBAL NA LISTA
- Nome do cliente: destaque maior do card.
- Sub-informações (segmento, tipo, notas): `text-xs text-gray-500`.
- Labels de métrica: `text-xs text-gray-500`.
- Valores de métrica: `text-sm ou text-base font-medium`.
- Nunca misturar muitos tamanhos de fonte diferentes no mesmo card.

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar APENAS o visual do Módulo de CLIENTES (visão geral), aplicando todas as regras acima.
2. Manter a mesma ordem e quantidade de clientes.
3. Não alterar lógica de filtros, cliques, navegação ou abertura de telas.

==================================================
🚫 NÃO FAÇA

- Não remover nenhum campo/linha de cliente.
- Não renomear componentes, props ou funções.
- Não mexer em estados ou hooks.
- Não alterar textos ou rótulos.
- Não criar novas cores fora da paleta (primária, secundária, neutros e cores de status já definidas globalmente).

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do módulo CLIENTES (visão geral) refatorado com:
  - Layout mais limpo e profissional.
  - Cards de clientes bem organizados em grid interno.
  - Tags e métricas padronizadas.
  - Total consistência visual com os módulos Dashboard, Tarefas e Projetos.
  - Nenhuma modificação de comportamento, apenas de design.

Comece agora aplicando essas melhorias ao arquivo do módulo CLIENTES (visão geral).
