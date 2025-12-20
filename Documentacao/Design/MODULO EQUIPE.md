MODULO EQUIPE

Você é responsável por REFINAR o DESIGN VISUAL do MÓDULO DE EQUIPE do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO alterar lógica, estados, hooks, rotas, requisições ou textos.
- NÃO mudar o comportamento de botões como “Adicionar membro”, “Editar”, “Arquivar”.
- Foque SOMENTE em layout, espaçamento, hierarquia visual, cores, tipografia e consistência com os outros módulos (Dashboard, Tarefas, Projetos, Clientes).

==================================================
🎯 CONTEXTO DA TELA

O módulo Equipe hoje tem:

- Um card grande centralizado com:
  - Título e descrição: “Organize os integrantes”, texto explicando função.
  - Botão “Adicionar membro”.
  - Filtros por status: “Ativos”, “Inativos”, “Todos”.
  - Tabela com colunas:
    - Nome
    - Função
    - Email
    - Capacidade (h/sem)
    - Status
    - Ações (Editar, Arquivar)

Quero que essa tela tenha cara de “gestão de time” moderna, leve e alinhada com o resto do sistema.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA GERAL
- Usar o mesmo padrão do restante do app:
  - Fundo da página: cinza claro (ex.: próximo de `#F9FAFB`).
  - Card principal de equipe: `bg-white rounded-xl border border-gray-200`.
  - Sombras discretas apenas se necessário (`shadow-sm` no máximo).
- Usar tipografia consistente:
  - Título do card: `text-2xl font-semibold`.
  - Descrição: `text-sm text-gray-600`.
  - Cabeçalho da tabela: `text-xs uppercase tracking-wide text-gray-500`.
  - Linhas: `text-sm text-gray-700`.

2) CARD PRINCIPAL “EQUIPE / ORGANIZE OS INTEGRANTES”
- Aumentar um pouco o padding do card:
  - Usar algo como `p-6` ou `p-8`.
- Layout do topo do card:
  - Lado esquerdo: título + descrição, alinhados verticalmente.
  - Lado direito: botão “Adicionar membro”.
  - Usar `flex` com `justify-between` e `items-start` ou `items-center`.

3) BOTÃO “ADICIONAR MEMBRO”
- Estilo de botão primário do sistema:
  - Cor primária (verde da marca).
  - `rounded-full` ou `rounded-lg` (o que estiver sendo usado globalmente).
  - Padding consistente (ex.: `px-5 py-2.5`).
  - `text-sm font-medium`.
- Hover: cor levemente mais escura.

4) FILTROS “ATIVOS / INATIVOS / TODOS”
- Transformar os filtros em um grupo de botões tipo “segmented control”:
  - `inline-flex` com gap pequeno.
  - Cada botão:
    - `rounded-full text-xs font-medium px-3 py-1.5`.
  - Estado selecionado:
    - Fundo com cor primária suave + texto na cor primária.
  - Estado não selecionado:
    - Fundo neutro (cinza muito claro) + borda leve ou sem borda.

5) TABELA DE INTEGRANTES
- Garantir que a tabela esteja visualmente integrada ao card:
  - Mesma cor de fundo do card.
  - Linhas com divisórias suaves: `border-b border-gray-100`.
  - Cabeçalho da tabela com:
    - background levemente diferente (`bg-gray-50`).
    - texto em `text-xs font-medium text-gray-500 uppercase tracking-wider`.
  - Primeira coluna (Nome) com mais destaque:
    - `text-sm font-medium text-gray-800`.
- Espaçamento vertical:
  - Linhas com `py-3` ou `py-4`.

6) COLUNA “STATUS”
- Usar chip/tag consistente com o resto da aplicação:
  - `rounded-full text-xs font-medium px-3 py-1`.
  - Status “Ativo” em verde suave.
  - Status “Inativo/Arquivado” em cinza ou outra cor padronizada definida globalmente.
- Centralizar visualmente o chip na célula.

7) COLUNA “AÇÕES”
- Botões “Editar” e “Arquivar” devem ser consistentes com os padrões globais:
  - Mesmo tamanho e border-radius.
  - `text-xs ou text-sm font-medium`.
  - “Editar”: estilo secundário/outline.
  - “Arquivar”: estilo destrutivo (texto vermelho, borda ou fundo muito suave em tom de vermelho).
- Manter o mesmo espaçamento entre os botões (ex.: `space-x-2`).

8) ESPAÇAMENTO INTERNO E HIERARQUIA
- Dentro do card:
  - Bloco topo (título + botão) → `mb-4` ou `mb-6`.
  - Filtros → `mb-4`.
  - Tabela ocupa o resto da área.
- Garantir que todo o conteúdo fique em uma largura confortável:
  - Ex.: usar `max-w-5xl` ou semelhante para o card, centralizado na tela.

9) TIPOGRAFIA EXTRA
- Labels de coluna: `text-xs` com `uppercase` e `tracking-wide`.
- Valores de capacidade (h/sem): `text-sm text-gray-700`.
- Emails: `text-sm text-gray-600`, podendo usar `truncate` se muito longos.

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar APENAS o visual do módulo Equipe, aplicando todas as regras acima.
2. Manter a estrutura de dados, lógica de filtros, clique em editar/arquivar e fluxo de “Adicionar membro” exatamente como estão.
3. Garantir que o módulo Equipe pareça parte do mesmo design system usado em Dashboard, Tarefas, Projetos e Clientes.

==================================================
🚫 NÃO FAÇA

- Não remover nenhuma coluna ou informação.
- Não renomear componentes, props ou funções.
- Não alterar textos ou rótulos.
- Não mexer em navegação ou rotas.
- Não adicionar novas cores fora da paleta (primária, secundária, neutros, cores de status já usadas).

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do módulo Equipe refatorado com:
  - Card principal mais bem organizado e alinhado.
  - Filtros com aparência de segmented control.
  - Tabela de integrantes limpa e legível.
  - Botões e chips padronizados com o resto do app.
  - Nenhuma mudança de funcionalidade, apenas refinamento visual.

Comece agora aplicando essas melhorias ao arquivo do módulo Equipe.
