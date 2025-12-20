VISÃO 360 CLIENTE

Você é responsável por REFINAR o DESIGN VISUAL da VISÃO 360 DO CLIENTE – ABA “VISÃO GERAL” do meu app (React + Tailwind e possivelmente shadcn/ui).

⚠ IMPORTANTE:
- NÃO alterar lógica, estados, hooks, rotas, requisições ou textos.
- NÃO mudar comportamento de botões como “Ver painel externo”, “Editar cliente”, “Arquivar”, “Sincronizar agora”, “Exportar CSV”, “Adicionar evento” etc.
- NÃO mexer na lógica das abas (Visão geral / Projetos & Tarefas / Configurações).
- Foque SOMENTE em layout, espaçamento, hierarquia visual, cores, tipografia e consistência com os outros módulos (Dashboard, Tarefas, Projetos, Clientes).

==================================================
🎯 CONTEXTO DA TELA

Esta aba contém:

1. HEADER DO CLIENTE (no topo, em verde):
   - Nome do cliente e responsável (ex.: SOBRESP Araguari – Narah Lopes).
   - Informações como: situação atual, segmento, orçamento mensal, plataformas.
   - Botões de ação: “Ver painel externo”, “Editar cliente”, “Arquivar”.

2. ABA “VISÃO GERAL” (selecionada em um grupo de abas):
   - Seção “Resultados por plataforma” com cards individuais:
     - Google Ads
     - Meta Ads
     - Google Analytics / GA4
     - Outros blocos de dados
   - Cada card mostra métricas (investimento, leads, CTR, conversões, etc.) e última atualização.

3. Seção “Relatórios exportáveis”:
   - Texto explicativo
   - Seletor de período (ex.: Últimos 7 dias)
   - Botão “Exportar CSV”.

4. Seção “Linha do tempo do cliente”:
   - Lista de cartões de histórico (integrações, status de GA4, diretórios vinculados, status Meta Ads etc.).
   - Filtros (campo “Todos” + botão “Atualizar”).
   - Cada item da timeline tem tags (ex.: Integração, Histórico, etc.), texto e data.

5. Formulário “Registrar novo evento”:
   - Select para tipo (ex.: Nota)
   - Campo de título
   - Textarea para detalhes adicionais
   - Botão “Adicionar evento”.

Quero que essa aba fique com cara de “painel executivo” de cliente, extremamente legível e coerente com o design global.

==================================================
🎨 REGRAS DE DESIGN (OBRIGATÓRIAS)

1) CONSISTÊNCIA GLOBAL
- Aplicar o mesmo padrão visual usado no Dashboard, Tarefas, Projetos e Clientes geral:
  - Fundo da página: cinza muito claro (ex.: algo próximo de `#F9FAFB`).
  - Cards: `bg-white`, `rounded-xl`, `border border-gray-200`.
  - Sombras apenas quando necessário (`shadow-sm` no máximo, se quiser dar leve destaque).
- Manter tipografia padrão:
  - Títulos principais: `text-2xl font-semibold`.
  - Títulos de seção: `text-lg font-semibold`.
  - Textos explicativos: `text-sm text-gray-600`.
  - Legendas/detalhes: `text-xs text-gray-500`.

2) HEADER DO CLIENTE (FAIXA VERDE SUPERIOR)
- Simplificar e harmonizar o gradiente (se houver), usando:
  - Cor sólida da marca OU gradiente suave dentro da mesma família de verde.
- Garantir legibilidade perfeita:
  - Nome do cliente: `text-2xl font-semibold text-white`.
  - Demais infos (situação atual, segmento, orçamento mensal, plataformas): `text-sm text-white/80`.
- Organizar os botões de ação (“Ver painel externo”, “Editar cliente”, “Arquivar”) em um grupo:
  - Usar o mesmo estilo que em outros módulos: botão primário + secundários/ghost.
  - `rounded-lg` ou `rounded-full` (igual ao resto do app).
  - Hover com leve mudança de cor.

3) ABA DE NAVEGAÇÃO (“Visão geral”, “Projetos & Tarefas”, “Configurações”)
- Garantir que as abas sigam um padrão de componente de tabs:
  - Abas com `border-b` e destaque na aba ativa (cor primária ou underline forte).
  - `text-sm font-medium` nas labels das abas.
  - Aba ativa com cor primária no texto e/ou fundo levemente diferente.

4) SEÇÃO “RESULTADOS POR PLATAFORMA”
- Colocar essa seção em um card grande:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Dentro dele, organizar:
  - Título da seção: `text-lg font-semibold`.
  - Subtítulo/descrição: `text-sm text-gray-600`.
  - Botões (“Sincronizar agora”) alinhados à direita, com estilo consistente.
- Os cards de cada plataforma (Google Ads, Meta Ads, GA4, etc.):
  - Também com `bg-white rounded-xl border border-gray-200 p-4 ou p-5`.
  - Dispostos em grid responsivo (2 colunas em desktop, se couber).
  - Título da plataforma: `text-sm font-semibold`.
  - Métricas internas em colunas/linhas com:
    - Label: `text-xs text-gray-500`.
    - Valor: `text-sm font-medium`.
  - Rodapé com “Última atualização” em `text-xs text-gray-500`.

5) SEÇÃO “RELATÓRIOS EXPORTÁVEIS”
- Card próprio:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Título da seção: `text-lg font-semibold`.
- Texto explicativo logo abaixo, `text-sm text-gray-600`.
- Alinhar seletor de período + botão “Exportar CSV” em linha (flex ou grid), com:
  - Select com largura adequada e label (ex.: “Período”).
  - Botão “Exportar CSV” como botão primário (cor da marca).

6) SEÇÃO “LINHA DO TEMPO DO CLIENTE”
- Card principal da timeline:
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Topo do card:
  - Título “Linha do tempo do cliente” (`text-lg font-semibold`).
  - Filtros alinhados à direita (ex.: select “Todos” + botão “Atualizar”).
- Cada item da timeline:
  - Conter:
    - Cabeçalho com tags (Integração, Histórico etc.) e data.
    - Título/resumo do evento.
    - Detalhes em `text-xs ou text-sm text-gray-600`.
  - Visual:
    - `rounded-xl border border-gray-200 bg-white p-4`.
    - `mb-4` entre os cards.
    - `hover:bg-gray-50` (se fizer sentido).
  - Tags:
    - Usar estilo de chip padrão:
      - `rounded-full text-xs font-medium px-3 py-1`.
      - Cores consistentes com resto do app (integração = talvez azul/roxo suave; alerta = amarelo/vermelho suave, etc.).

7) FORMULÁRIO “REGISTRAR NOVO EVENTO”
- Colocar o formulário dentro do mesmo card da timeline ou em card separado logo abaixo (escolha uma abordagem, mas mantenha consistente):
  - `bg-white rounded-xl border border-gray-200 p-6`.
- Campos:
  - Seletores (tipo de evento) com label `text-xs text-gray-600`.
  - Campo de título (input) e textarea com largura total do card.
  - Espaçamento vertical consistente entre os campos (`space-y-4` por exemplo).
- Botão “Adicionar evento”:
  - Estilo de botão primário, alinhado à direita ou à esquerda, mas com boa margem superior.
  - Mesmo padrão de botão usado no resto da aplicação.

8) ESPAÇAMENTO ENTRE SEÇÕES
- Entre cada grande bloco (Resultados por plataforma, Relatórios exportáveis, Linha do tempo + formulário):
  - Usar `mt-8` ou `space-y-8`.
- Dentro dos cards, manter `p-6` como padrão, ajustando para `p-4` em subcards internos, se necessário.

9) TIPOGRAFIA E HIERARQUIA
- Garantir que:
  - Nome do cliente (header superior) seja a informação de maior destaque.
  - Títulos das seções (“Resultados por plataforma”, “Relatórios exportáveis”, “Linha do tempo do cliente”, “Registrar novo evento”) tenham o mesmo estilo de heading.
  - Textos descritivos não usem fonte muito grande; manter `text-sm` para deixar a tela limpa.

==================================================
🛠 O QUE FAZER AGORA

1. Refatorar APENAS o visual da aba “Visão geral” da Visão 360 do Cliente, aplicando todas as regras acima.
2. Manter toda a lógica de sincronização, exportação, timeline e criação de eventos intacta.
3. Garantir que o resultado final tenha:
   - Cara de “painel executivo” de cliente.
   - Alinhamento visual com Dashboard, Tarefas, Projetos e Clientes geral.
   - Leitura fluida em monitores grandes.

==================================================
🚫 NÃO FAÇA

- Não remover nenhuma métrica, card ou bloco de informação.
- Não renomear componentes, props ou funções.
- Não alterar textos, rótulos ou copy.
- Não mexer na navegação de abas.
- Não adicionar novas cores fora da paleta global.

==================================================
📦 ENTREGA ESPERADA

- Código JSX/TSX da aba “Visão geral” da Visão 360 do Cliente refatorado com:
  - Layout mais organizado e profissional.
  - Cards e seções visualmente bem separados.
  - Timeline limpa e fácil de ler.
  - Formulário de novo evento bem integrado visualmente.
  - Nenhuma mudança de funcionalidade, apenas refinamento visual.

Comece agora aplicando essas melhorias ao arquivo da aba “Visão geral” da Visão 360 do Cliente.
