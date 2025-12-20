SIDEBAR

Refatore SOMENTE o design da SIDEBAR do app, mantendo a mesma estrutura, rotas e lógica.  

Regras obrigatórias:

1. Visual geral:
- substituir fundo sólido por leve gradiente:
  `bg-gradient-to-b from-green-900 to-green-950/80`
- adicionar `shadow-lg` muito sutil na borda direita: `shadow-[inset_-4px_0px_8px_rgba(0,0,0,0.3)]`
- manter largura entre `w-56` e `w-64`.

2. Estrutura visual:
- separar blocos com títulos em `text-xs font-semibold tracking-wide text-white/40 uppercase`.
- adicionar divisórias suaves: `border-b border-white/10` com espaçamento `my-4`.

3. Botões do menu (Dashboard, Tarefas, Projetos, etc):
- transformar itens em botões “pill” modernos:
  - `rounded-lg px-3 py-2`
  - `text-sm font-medium`
  - hover: `bg-white/15`
- item ativo:
  - `bg-white text-green-900 shadow-sm font-semibold`.

4. Ícones:
- adicionar ícones de 16px antes de cada item usando Lucide Icons.
- ícone do item ativo deve ter cor `text-green-900`.

5. Bloco “Conectado”:
- transformar o bloco do email em um card:
  - `bg-white/10 rounded-lg p-3`
  - email em `text-sm text-white`
  - botão sair: pequeno, outline branco suave.

6. Bloco “Status dos Serviços”:
- colocar dentro de card:
  - `bg-white/10 rounded-lg p-3 text-sm text-white/80`
  - ícones de status (ex.: bullet verde) padronizados.

7. Rodapé:
- “Powered by Taskora” em:
  - `text-[10px] text-white/30 uppercase tracking-wider text-center py-3`.

IMPORTANTE:
- não alterar rotas, links, nomes ou lógica.
- não mover a sidebar de lugar.
- alterar SOMENTE visuais e classes Tailwind.

Entregue o JSX/TSX atualizado com as classes e estilos revisados.
