Quero que você faça uma refatoração de FRONTEND apenas no módulo "Histórico de Tarefas" do meu app Taskora (React + Tailwind).

IMPORTANTE:
- As mudanças são APENAS visuais (JSX + Tailwind) e de textos (labels amigáveis).

======================================================================
PARTE 1 – ORGANIZAR APENAS O BLOCO DE FILTROS DO HISTÓRICO
======================================================================

Hoje o bloco de filtros do Histórico de Tarefas está visualmente confuso (“frankenstein”):
- muitos elementos colados,
- chips e selects misturados,
- layout sem grid definido.

Quero que você reorganize SOMENTE o filtro dessa tela, deixando-o mais limpo e legível, mas mantendo os mesmos campos e a mesma lógica.

1. Encontre o componente do Histórico de Tarefas (ex.: `TaskHistory`, `HistoryPage`, ou similar) e localize a seção de filtros.

2. Envolva os filtros atuais em um CARD visual, apenas dentro desse componente:
   - Container do filtro:
     - `className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-4"`

3. Dentro desse card do filtro, organize os controles em linhas usando grid:

   Sugestão de estrutura:

   - Linha 1 (selects principais), use algo como:
     - `<div className="grid gap-4 md:grid-cols-3">`
       - Select "Cliente"
       - Select "Projeto"
       - Select "Responsável"

   - Linha 2 (chips de tipo de evento e período), por exemplo:
     - `<div className="grid gap-4 md:grid-cols-2">`
       - Coluna 1: "Tipo de evento" (chips: Tarefa, Hora, Anotação, Alerta, Integração, etc.)
       - Coluna 2: "Período" (chips: Últimos 7 dias, Últimos 30 dias, Personalizado, etc.)

   Se houver outros filtros específicos do histórico (ex.: tipo de ação, origem, canal), pode colocá-los em uma terceira linha.

4. Padrão visual para label + campo:
   - Label:
     - `className="text-xs font-medium text-gray-500 mb-1 block"`
   - Select / input:
     - `className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"`

5. Padrão visual para CHIPS de filtro (tipo de evento, período, etc.):
   - Container:
     - `className="flex flex-wrap gap-2"`
   - Chip base:
     - `className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer select-none"`
   - Estado inativo:
     - `bg-gray-100 text-gray-600 hover:bg-gray-200`
   - Estado ativo:
     - `bg-emerald-50 text-emerald-700 border border-emerald-200`

6. Botões de ação do filtro (se existirem, tipo “Aplicar filtros” / “Limpar”):
   - Devem ficar alinhados à direita, logo abaixo das linhas de filtro:
     - `<div className="flex justify-end gap-3 pt-2 border-t border-gray-100">`
   - Estilos:
     - Limpar:
       - `className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"`
     - Aplicar:
       - `className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"`

7. Responsividade:
   - Em mobile, `grid-cols-1` com `gap-3`.
   - Em telas médias/maiores, usar `md:grid-cols-2` ou `md:grid-cols-3`, como sugerido acima.
   - Garantir que o filtro não fique “espremido” nem com elementos amontoados.

Ref ref: LEMBRE-SE: essa organização de filtro vale APENAS para o Histórico. Não reaproveite em outros módulos.

======================================================================
PARTE 2 – MELHORAR OS CARDS DO HISTÓRICO (TIMELINE + NOMES AMIGÁVEIS)
======================================================================

Agora, ainda na mesma tela do Histórico:

Quero que os eventos do histórico:
- fiquem visualmente mais bonitos (estilo timeline),
- usem nomes amigáveis para humanos, e não códigos internos.

Atualmente, cada evento tem:
- tipo interno (ex.: `task_status_updated`, `task_priority_changed`),
- timestamps,
- referências a tarefa, projeto, cliente, plataforma,
- usuário/responsável (em geral um email),
- eventualmente IDs/códigos.

Quero que:

1. Cada evento seja um CARD em formato de timeline:

   - Container geral da lista de eventos:
     - use algo como: `className="space-y-4"`

   - Cada evento:
     - Wrapper externo (linha da timeline):
       - `className="flex items-start gap-4"`
     - Coluna esquerda: marcador da timeline:
       - `<div className="flex flex-col items-center pt-2">`
       - Dot:
         - `className="w-2 h-2 rounded-full bg-emerald-500"`
       - Linha vertical (para preencher o espaço abaixo do dot se houver mais itens):
         - `className="w-px flex-1 bg-gray-200 mt-1"`

     - Coluna direita: CARD do evento:
       - `className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 space-y-3"`

2. Dentro do CARD, organizar em 3 blocos:

   (A) HEADER
   - Primeira linha:
     - Esquerda: tipo AMIGÁVEL do evento (ex.: "Status atualizado", "Prioridade ajustada", "Hora registrada").
       - `className="text-sm font-semibold text-gray-800"`
     - Direita: data e hora do evento, formatadas:
       - `className="text-xs text-gray-500"`

   (B) CORPO
   - Frase descritiva, clara, usando nomes amigáveis:
     Exemplos:
       - `A tarefa "Relatórios Novembro 2025" mudou de "A fazer" para "Concluída".`
       - `A prioridade da tarefa "Criativos Novembro" mudou de "Média" para "Alta".`
       - `Registradas 00:45h na tarefa "Otimizações Pontuais – Novembro".`
       - `A tarefa "Criativo da semana" foi movida de "Backlog" para "Em andamento".`

   - Logo abaixo, uma linha de tags/chips com informações importantes:
     - Cliente
     - Projeto
     - Plataforma (Google Ads, Meta Ads, GA4…)
     - Outros detalhes relevantes, se houver.

     Container de tags:
       - `className="flex flex-wrap gap-2 mt-2"`

   (C) FOOTER
   - Texto pequeno, indicando quem registrou:
     - `className="text-[11px] text-gray-500"`
     - Exemplo:
       - `Registrado por Flávio Corá`

3. Mapear códigos para nomes amigáveis:

   Crie um pequeno arquivo utilitário (ou use um já existente) apenas para formatação, por exemplo:
   - `src/lib/historyFormat.ts` (ou algo nessa linha).

   Nesse arquivo, crie funções do tipo:

   ```ts
   export function formatEventType(type: string): string {
     const map: Record<string, string> = {
       task_status_updated: "Status atualizado",
       task_priority_changed: "Prioridade ajustada",
       task_moved: "Tarefa movida",
       hour_logged: "Hora registrada",
       note_added: "Anotação adicionada",
       integration_event: "Integração"
     };
     return map[type] ?? type;
   }

   export function formatPlatform(code: string): string {
     const map: Record<string, string> = {
       google_ads: "Google Ads",
       meta_ads: "Meta Ads",
       ga4: "GA4",
       pinterest_ads: "Pinterest Ads"
     };
     return map[code] ?? code;
   }

   export function formatUserName(emailOrId: string): string {
     // Se vier um nome já pronto do backend, use.
     // Se vier apenas email, use a parte antes do "@" e capitalize.
   }
