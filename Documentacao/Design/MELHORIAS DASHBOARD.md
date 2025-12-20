MELHORIAS DASHBOARD

Você é responsável por REFINAR o DESIGN VISUAL do meu dashboard em React + Tailwind + (se houver) shadcn/ui.

⚠ IMPORTANTE:
- NÃO altere lógica, dados, rotas, estados ou textos.
- NÃO mexa em navegação/menus/estrutura funcional.
- Foque SOMENTE em layout, espaçamento, cores e estilos.

===========================================================
🎯 OBJETIVO

Transformar o dashboard em uma UI mais profissional, limpa e consistente, mantendo a identidade atual, mas polindo os elementos visuais.

===========================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1. BORDER-RADIUS
- Use SEMPRE o mesmo radius para todos os cards e containers principais.
- Padrão: `rounded-xl` (aprox. 12px) em todos os cards de conteúdo e métricas.

2. SOMBRAS
- Cards principais de métrica (topo/hero): `shadow-sm` discreto.
- Cards de listas/tabelas/conteúdo: sem sombra, apenas borda leve.
- Proposta de borda: `border border-gray-200` (ou equivalente no projeto).

3. ESPAÇAMENTO
- Entre seções grandes do dashboard: use um padrão (por exemplo `mt-8` ou `py-8`) e aplique de forma consistente.
- Dentro dos cards: use `p-6` como padrão geral.
- Evite paddings aleatórios como `p-3`, `p-5`, `p-7`. Priorize múltiplos coerentes: 4, 6, 8.

4. CORES
- Cor primária: manter o verde atual da marca (verde petróleo).
- Cor secundária: escolha APENAS UMA entre amarelo OU laranja para destaques. Unifique para não misturar muitas cores quentes.
- Cor de alerta/erro: vermelho suave (ex.: classe equivalente a `red-400`).
- Fundo dos cards: branco.
- Fundo da página: cinza bem claro (ex.: perto de `#F9FAFB`).

5. SEÇÃO “VISÃO GERAL DA OPERAÇÃO” (HERO)
- Hoje há um gradiente forte (verde → alaranjado) que cansa a visão.
- Substitua por UMA das opções:
  a) Cor sólida escura elegante (ex.: variante mais escura do verde principal), OU
  b) Gradiente suave dentro da mesma família de cor (ex.: `from-green-900 to-green-700`).
- Mantenha os textos totalmente legíveis (bom contraste com branco).

6. TIPOGRAFIA
- Manter a fonte atual (ex.: Inter/Roboto/SF).
- Padrões:
  - Títulos de seção: `text-2xl font-semibold`.
  - Subtítulos: `text-lg text-gray-600`.
  - Texto padrão em cards e listas: `text-sm text-gray-700`.
  - Legendas/infos menores: `text-xs text-gray-500`.

7. CONSISTÊNCIA ENTRE CARDS
- TODO card do dashboard deve seguir o mesmo “esqueleto visual”:
  - `rounded-xl`
  - `border-gray-200`
  - `p-6`
  - `bg-white`
- Apenas os cards principais (métricas críticas / hero) podem ter `shadow-sm`. Os outros, sem sombra.

===========================================================
🛠 O QUE VOCÊ DEVE FAZER AGORA

1. Trabalhar SOMENTE no arquivo do DASHBOARD (tela principal que contém:
   - Visão geral da operação
   - Investimentos / saldos / limites
   - Pipeline por projeto / quadro de tarefas
   - Produtividade / horas registradas
   - Integrações / saúde do sistema
   - Status consolidado / alertas / integrações por cliente
).

2. Aplicar todas as regras acima aos componentes deste arquivo:
   - Não alterar o conteúdo nem os componentes funcionais (ex.: hooks, requisições, lógica).
   - Apenas ajustar:
     - classes do Tailwind
     - estilos
     - espaçamentos
     - cores (dentro das diretrizes)
     - sombras
     - border-radius

3. Melhorar a legibilidade:
   - Verifique alinhamento de títulos, subtítulos e descrições.
   - Garanta que haja espaço suficiente entre seções.
   - Padronize margens internas dos títulos nos cards (por exemplo, mesma distância do topo do card até o título em todos).

===========================================================
🚫 NÃO FAÇA

- NÃO renomeie componentes.
- NÃO mude props ou a estrutura dos dados.
- NÃO remova nenhuma seção do dashboard.
- NÃO crie novas cores fora da paleta proposta.
- NÃO altere a sidebar, menu ou navegação global.

===========================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX do dashboard refatorado, com:
  - Estilos mais limpos e consistentes.
  - Mesma funcionalidade atual.
  - Comentários curtos apenas se houver alguma mudança visual relevante que mereça explicação.

Comece agora aplicando essas melhorias ao arquivo do dashboard.
