## Prompt para o Codex – Refinar o visual do PDF "Relatório de Entregas por Cliente"

Você é o dev sênior do **Taskora / Console Operacional**. Já existe o recurso **Relatório de Entregas por Cliente**, com exportação em PDF, num formato parecido com:

- Título: `Relatorio de entregas por cliente`
- Cabeçalho de metadados: `Organizacao`, `Periodo`, `Modo`, `Tipos`
- Depois, blocos por cliente, com o nome do cliente em texto simples e uma lista de linhas:
  - `2025-12-15 - Atualizar criativos da Agrisys (Criativo)`
  - `Projeto: ...`
  - `Responsaveis: ...`
  - Descrição/observações grandes logo abaixo (legendas, textos longos, links).  

O PDF atual está **funcional**, mas visualmente muito cru: tudo em texto corrido, sem hierarquia tipográfica clara, pouco espaçamento, links enormes quebrando linha, e nenhum resumo visual por cliente. Fica mais parecendo um dump de log do que um relatório para mostrar para o cliente ou guardar de forma elegante.

Quero que você **refine o layout do PDF**, mantendo o conteúdo, mas deixando o relatório muito mais legível e apresentável.

---

## 1. Localizar o código atual

1. Procure no código por strings como:
   - `"Relatorio de entregas por cliente"`
   - ou o nome da rota de exportação usada pelo Relatório de Entregas (ex.: algo em `reports`, `tasksByClient`, `exportPdf` etc.).
2. Descubra:
   - qual biblioteca está sendo usada para gerar PDF (ex.: pdfkit, puppeteer/Playwright com HTML→PDF, jsPDF, etc.);
   - onde está a função principal de geração do PDF (arquivo e nome da função);
   - como ela é chamada a partir da API (rota e serviço).
3. Antes de mudar qualquer coisa, deixe um comentário curto na função principal explicando que você vai refinar o layout, com referência ao novo design.

Se não existir uma função separada para esse relatório, crie uma (ex.: `generateTasksByClientReportPdf(...)`) e mova a lógica atual para lá antes de refatorar.

---

## 2. Objetivos de design do novo PDF

Quero que o PDF final tenha uma cara de **relatório profissional**, com foco em legibilidade. Em alto nível:

1. **Cabeçalho limpo e forte**
   - Título: `Relatório de Entregas por Cliente` (acentuação corrigida) em fonte maior.
   - Subtítulo com:
     - Nome da organização (ex.: `Allgrotech`).
     - Período (`18/11/2025 a 17/12/2025` no formato BR).
     - Modo (`Resumo` ou `Todas as tarefas`).
   - Linha secundária para `Tipos` (lista de categorias incluídas), formatada em uma linha discreta (fonte menor/cinza).

2. **Agrupamento visual por cliente**
   - Cada cliente deve aparecer como um **bloco bem definido**, por exemplo:
     - Nome do cliente como título em negrito, fonte maior (H2), com espaçamento antes/depois.
     - Uma linha-resumo opcional logo abaixo, com contagens (ex.: `3 relatórios, 2 criativos, 1 boleto no período`).
     - Lista das tarefas abaixo, com layout consistente.
   - Use separadores suaves entre clientes (linha horizontal fina, ou espaçamento generoso), evitando que o conteúdo de um grude no outro.

3. **Layout das tarefas**
   - Para cada tarefa, quero um formato mais estruturado, por exemplo:

     ```text
     15/12/2025  •  Criativo  •  Atualizar criativos da Agrisys
     Projeto: Agrisys - Campanhas e Criativos
     Responsáveis: Fulano, Sicrano
     Observações: (primeiras linhas da descrição, truncadas se muito longas)
     ```

   - A data deve ser exibida em formato `dd/MM/yyyy`.
   - O tipo (Relatório, Feedback, Boleto, Reunião, Criativo, Otimização, Campanha, Nota, Outros) pode aparecer como um badge/label textual (ex.: entre colchetes ou com caixa alta) para destacar rapidamente a natureza da entrega.
   - O título da tarefa deve aparecer na mesma linha da data/tipo, para leitura rápida.

4. **Descrição e links longos**
   - Hoje algumas tarefas têm descrições enormes com legendas completas de anúncio, parágrafos e links gigantes.
   - Regra desejada:
     - Mostrar apenas as **primeiras N linhas** (por ex. ~2–3 linhas) da descrição no corpo principal.
     - Se houver texto extra, adicionar algo como `[...]` no final, indicando que foi truncado.
     - URLs grandes devem ser:
       - encurtadas visualmente (ex.: mostrar só o domínio + `...`), ou
       - movidas para uma seção de "Referências" ou "Links" ao final do PDF, referenciadas por número (opcional).
   - Se a biblioteca suportar links clicáveis, mantenha-os, mas com rótulos curtos (ex.: `Ver criativo` em vez da URL completa).

5. **Paginação, cabeçalho e rodapé**
   - Em cada página:
     - Cabeçalho simples com nome da organização + título curto do relatório (ex.: `Relatório de Entregas – Allgrotech`).
     - Rodapé com número da página (`Página X de Y`) e data de geração do relatório.
   - Evitar quebrar o nome do cliente na última linha da página – se possível, empurre o bloco do cliente para a próxima página quando o título + primeira tarefa não couberem.

6. **Tipografia e espaçamento**
   - Use hierarquia clara de tamanho de fonte:
     - Título principal > nome de cliente > título de tarefa > metadados (projeto, responsáveis) > descrições.
   - Aumente o espaçamento vertical entre blocos de clientes.
   - Garanta margens consistentes (superior/inferior/esquerda/direita) para impressão.

7. **Metadados do arquivo**
   - Ajuste o nome do arquivo gerado para algo como:
     - `Relatorio-de-Entregas_{orgSlug}_{YYYY-MM-DD}_modo-{summaryOrAll}.pdf`.
   - Se a lib permitir, preencha os metadados de título/autor/subject do PDF.

---

## 3. Implementação (passos sugeridos)

1. **Refatorar a função de geração de PDF**
   - Envolva a lógica em uma função claramente nomeada (ex.: `generateTasksByClientReportPdf(params)`), com parâmetros explícitos: organização, período, modo, tipos, lista de clientes e tarefas agrupadas.
   - Mantenha a API atual que chama essa função para não quebrar os consumidores.

2. **Modelar uma estrutura intermediária de layout**
   - Antes de escrever no PDF, crie um modelo em memória com a estrutura:

     ```ts
     interface TasksByClientReportLayout {
       orgName: string;
       periodStart: string; // ISO ou Date
       periodEnd: string;
       mode: "summary" | "all";
       types: string[];
       generatedAt: Date;
       clients: Array<{
         clientName: string;
         summaryByType?: Array<{ type: string; count: number }>;
         tasks: Array<{
           date: Date;
           type: string;
           title: string;
           projectName?: string;
           assignees?: string[];
           description?: string;
         }>;
       }>;
     }
     ```

   - Essa estrutura ajuda a separar regra de negócio de layout.

3. **Aplicar o layout na biblioteca de PDF**
   - Se for HTML→PDF (puppeteer/Playwright):
     - Crie um template HTML/CSS dedicado para o relatório, com estilos para:
       - cabeçalho
       - bloco de cliente
       - lista de tarefas
       - labels de tipo
       - descrições truncadas.
     - Use CSS para controlar quebras de página (`page-break-inside: avoid` em blocos de clientes).
   - Se for uma lib de desenho direto (pdfkit/jsPDF etc.):
     - Extraia helpers para desenhar:
       - cabeçalho,
       - bloco de cliente,
       - entrada de tarefa,
       - e rodapé.
     - Centralize lógica de cálculo de Y/mudança de página.

4. **Truncar descrições e links**
   - Implemente uma função utilitária para truncar texto de descrição para um limite de caracteres/linhas (p. ex. 250–300 caracteres), respeitando palavras.
   - Para cada URL na descrição, considere:
     - manter o link clicável mas com label curto (ex.: `Ver link`), ou
     - mover para uma pequena linha "Links" depois da tarefa.

5. **Resumo por cliente (opcional, mas desejável)**
   - Calcule, para cada cliente, quantas tarefas de cada tipo foram feitas no período.
   - Exiba logo após o nome do cliente, em uma linha discreta, por exemplo:

     `Resumo: 3 Relatórios • 2 Criativos • 1 Boleto`

6. **Internacionalização pequena**
   - Ajuste textos fixos para PT-BR padrão e com acentuação correta:
     - `Relatório de Entregas por Cliente`
     - `Organização`, `Período`, `Modo`, `Tipos` etc.
   - Formate datas sempre em `dd/MM/yyyy`.

---

## 4. Testes e validação

1. Gere PDFs de teste com:
   - período com poucos clientes/tarefas;
   - período com muitos clientes e tarefas longas (textos e links grandes).
2. Verifique:
   - se o cabeçalho aparece corretamente em todas as páginas;
   - se blocos de clientes não estão quebrando de forma estranha;
   - se descrições muito longas são truncadas sem quebrar o layout.
3. Se existirem testes automatizados para exportação, atualize-os para validar pelo menos:
   - geração sem erro;
   - presença do título e de um cliente/tarefa esperado no conteúdo textual extraído.

Documente no código (comentário curto na função de geração do PDF) os principais aspectos do layout, para que futuros devs entendam a intenção visual.

---

## 5. Estilo de trabalho

- Faça commits em blocos lógicos: refatoração da função de PDF, criação do template/layout, truncamento de descrições, ajustes de cabeçalho/rodapé.
- Mantenha o comportamento da API de export no mesmo endpoint, apenas melhorando o visual.
- No final, escreva um pequeno resumo (em `Documentacao/Relatorios` ou similar) explicando como é o novo layout do PDF de Entregas por Cliente e quais são as limitações conhecidas (se houver).

