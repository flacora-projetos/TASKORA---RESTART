## Prompt para o Codex – PDF de Entregas Round 2 (puxão de orelha, páginas em branco e logo da org)

Você é o dev sênior do **Taskora / Console Operacional**. Você JÁ implementou o **Relatório de Entregas por Cliente** com exportação para PDF e fez alguns ajustes de layout (truncar observações, colocar labels de link como "Ver criativo no Instagram", agrupar por cliente, etc.).

Mas o PDF atual ainda tem problemas sérios e o visual continua tímido demais.

O arquivo atual de referência é o relatório da organização **Allgrotech** para o período `18/11/2025 a 17/12/2025`. Ele está gerando **12 páginas**, sendo que:

- Conteúdo real (clientes + tarefas) aparece só nas 3 primeiras páginas.
- As páginas 4 a 12 estão praticamente em branco, contendo apenas elementos de rodapé/cabeçalho separados, como:
  - `Pagina 1 de 3`, `Pagina 2 de 3`, `Pagina 3 de 3`
  - `Gerado em 17/12/2025`
  - `Relatório de Entregas - Allgrotech`

Ou seja: você dividiu header/footer em páginas isoladas. Além disso, visualmente ainda está básico demais para chamar de relatório profissional.

Quero que você faça um **round 2 bem caprichado**, com foco em:

1. **Corrigir o bug das páginas em branco**.
2. **Consolidar header/footer decentes em cada página, sem criar páginas extras**.
3. **Incluir a logo da organização no cabeçalho**.
4. **Dar um passo a mais no acabamento visual geral.**

---

## 1. Corrigir o bug das páginas em branco / paginação

Hoje o PDF está assim:

- Páginas 1–3: conteúdo + (talvez) parte do rodapé.
- Páginas 4–12: apenas elementos soltos de rodapé/cabeçalho.

Você precisa:

1. Revisar a função de geração de PDF deste relatório (HTML→PDF ou pdfkit/jsPDF, o que estiver usando).
2. Garantir que **NENHUM** header/footer gere nova página sozinho.
3. Aplicar o header/footer **dentro do fluxo das páginas já existentes**.

### Se for HTML → PDF (puppeteer/Playwright, por exemplo):

- Use um template único de página e header/footer via CSS (`@page` / `margin boxes` / `position: fixed`), em vez de duplicar conteúdo em divs que forçam quebras.
- Evite `page-break-before/after` no header/footer.
- Teste com este relatório específico até o PDF sair com **apenas 3 páginas** e todo header/footer em cada uma delas.

### Se for pdfkit/jsPDF ou similar (desenho manual):

- Não dê `doc.addPage()` para desenhar somente header ou footer.
- Em vez disso, numa função `drawHeaderAndFooter(doc, pageNumber, totalPages, orgName, generatedAt)`, desenhe o cabeçalho e rodapé **no início/fim de cada página**, dentro do fluxo normal.
- Se estiver iterando manualmente páginas, calcule `totalPages` e desenhe header/footer na passagem correta, sem criar páginas extras.

No fim, a regra é simples: **número de páginas = necessário para o conteúdo**. Header/footer são desenhados nelas, não em páginas separadas.

---

## 2. Header e footer consolidados (mesma página, layout limpo)

Hoje você está imprimindo coisas como:

- `Relatório de Entregas - Allgrotech`
- `Pagina X de 3`
- `Gerado em 17/12/2025`

Mas elas aparecem soltas em páginas diferentes.

Quero que você consolide assim:

### Cabeçalho (topo de cada página)

- Logo da organização (ver seção 3).
- Ao lado (ou abaixo) da logo, texto:
  - `Relatório de Entregas por Cliente`
  - `Organização: {orgName}`
  - `Período: dd/MM/yyyy a dd/MM/yyyy`
  - `Modo: Resumo` ou `Modo: Todas as tarefas`

### Rodapé (base de cada página)

Uma única linha com algo do tipo:

`Relatório de Entregas – {orgName}  •  Página {page} de {totalPages}  •  Gerado em dd/MM/yyyy`

Requisitos:

- Essa linha deve aparecer **em TODAS as páginas de conteúdo**.
- Não pode existir página cujo único conteúdo seja essa linha.

---

## 3. Incluir e ajustar a logo da organização

Quero a logo da organização no cabeçalho do PDF.

1. Localize onde os dados da organização são carregados para o relatório (provavelmente a partir de `orgId` / `organizations` collection).
2. Verifique se já existe um campo de logo (ex.: `logoUrl`, `brand.logo`, etc.). Se já existir, use-o. Se não existir, faça o seguinte:
   - Procure se o projeto já tem alguma logo padrão da Dácora/Allgrotech em assets.
   - Implemente de forma que, se a org tiver logo configurada, use a logo; se não tiver, apenas não mostre imagem e mantenha texto.
3. No layout do PDF:
   - Coloque a logo no topo esquerdo ou direito (escolha uma posição e mantenha consistente).
   - Defina **tamanho máximo** (ex.: largura máx. de 120–150 px, mantendo proporção), para ela não explodir o layout.
   - Deixe um bom espaçamento entre a logo e os textos do cabeçalho.

Nada de logo gigante estourando página. Prefira logo relativamente discreta, mas presente.

---

## 4. Acabamento visual adicional (round 2 de design)

Você já melhorou algumas coisas (truncar observações, usar textos como `[...] (texto completo no Taskora)`, label de links "Ver criativo no Instagram" etc.), mas ainda está tudo com cara de bloco de texto monolítico.

Quero que você dê mais um passo:

1. **Bloco de cliente mais destacado**
   - Nome do cliente como título (fonte maior, bold).
   - `Resumo: ...` logo abaixo, em fonte um pouco menor e cor mais suave (cinza).
   - Espaçamento extra antes de cada cliente, para ficar visualmente separado.

2. **Lista de tarefas mais organizada**
   - Mantenha a linha principal no formato:  
     `dd/MM/yyyy  •  TIPO  •  Título da tarefa`
   - Deixe o TIPO em caixa alta (RELATÓRIO, CRIATIVO, BOLETO, REUNIÃO, etc.), podendo usar colchetes (`[RELATÓRIO]`) se ajudar a ler.
   - `Projeto:` e `Responsáveis:` em linhas logo abaixo, com fonte um pouco menor.

3. **Observações mais discretas**
   - Mantenha a truncagem, mas diminua o peso visual:
     - "Observações:" em negrito, texto menor, espaçamento menor.
     - Se não houver observações, não renderize a linha.

4. **Links mais limpos**
   - Continue usando labels curtos tipo `[Ver criativo no Instagram]`, `[Ver arquivo no Drive]`.
   - Evite mostrar URLs enormes. Se ainda estiver imprimindo a URL inteira, remova essa linha — o link clicável com label é suficiente.

5. **Margens e densidade**
   - Garanta margens externas consistentes (topo, base, esquerda, direita) e uma quantidade de texto por página que não fique nem apertado demais nem espaçado demais.

---

## 5. Testes concretos que você PRECISA rodar

Não basta compilar. Quero que você rode pelo menos estes testes manuais:

1. Gerar novamente o PDF de **Allgrotech** para o período `18/11/2025 a 17/12/2025`:
   - Confirmar que o número de páginas é **3** (ou o mínimo necessário para o conteúdo real), sem páginas vazias com apenas rodapé/cabeçalho.
   - Verificar que **todas** as páginas possuem header + footer completos.
2. Conferir se pelo menos um cliente com várias tarefas (ex.: Allgrotech) está visualmente mais organizado, com:
   - nome do cliente claramente destacado,
   - resumo legível,
   - tarefas bem alinhadas com `DATA • TIPO • TÍTULO`.
3. Conferir se a logo da organização aparece corretamente (tamanho razoável, sem estourar). Se a org não tiver logo, o PDF deve continuar funcionando sem erro.

Se existirem testes automatizados, você pode complementar com asserts básicos (gerar PDF sem lançar exceção, verificar presença de alguns textos-chave), mas aqui o essencial é o teste manual de layout.

---

## 6. Estilo de entrega

- Mantenha o endpoint e a assinatura das funções públicas como estão (não quebre a API).
- Faça commits organizados: um para refator de footer/header/paginação, outro para logo, outro para ajustes visuais finos.
- Documente rapidamente (em comentário na função de geração do PDF ou em `Documentacao/Relatorios`) os pontos principais do design, para o próximo dev entender a intenção.

No final, deixe um resumo no changelog interno descrevendo:

- que o bug de páginas em branco foi corrigido;
- que o header/footer agora são consistentes em todas as páginas;
- que a logo da org foi adicionada;
- e que o layout por cliente foi refinado para leitura mais agradável.

