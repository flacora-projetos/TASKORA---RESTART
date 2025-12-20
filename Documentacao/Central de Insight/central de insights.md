A seguir está o contexto do produto e a descrição de uma nova funcionalidade. Use isso para propor arquitetura, modelo de dados e roadmap técnico. **NÃO escreva código nessa primeira resposta**. Concentre-se apenas em planejamento, estrutura e decisões técnicas. Responda em **português (pt-BR)**.

---

## 1. Contexto geral do produto

Você é um dev sênior trabalhando em um **SaaS para agências de marketing digital** (MVP), com foco em gestão de tarefas, clientes e projetos, além de integrações com plataformas de mídia paga.

Tecnologias principais (já existentes no projeto):

* Frontend: **React** (SPA)
* Backend/Infra: **Firebase + Google Cloud**

  * Firebase Auth (multi-usuário, possivelmente multi-tenant por agência)
  * Firestore (banco principal)
  * Storage (para imagens/arquivos)
* Integrações: Google Ads, Meta Ads, GA4, etc.

Módulos que já existem ou estão em desenvolvimento:

* Dashboard geral
* Tarefas
* Projetos
* Clientes / Client 360
* Calendário
* Integrações com plataformas de mídia

No momento, o sistema será usado por **poucos usuários (por volta de 3)**, mas a arquitetura deve ser pensada para **escalar depois** (multi-cliente / multi-agência, muitos usuários por conta).

---

## 2. Nova funcionalidade: módulo “Central de Insights”

Queremos adicionar um novo módulo na sidebar chamado **“Central de Insights”**, com duas abas internas:

1. **Aba 1: Feedback do App**
   Objetivo: ser um feed simples onde os usuários podem registrar:

   * **Bugs**
   * **Melhorias desejadas**
   * **Novas ideias** para o produto

   Requisitos iniciais (alta prioridade):

   * Criar posts de feedback com campos como:

     * Tipo: `bug | melhoria | ideia`
     * Título
     * Descrição
     * (Opcional) anexar imagem/print
   * Atribuir um status ao item:

     * `aberto | em_analise | em_desenvolvimento | entregue`
   * Permitir comentários em cada item
   * Permitir que outros usuários marquem algo como “também quero” (ex.: um contador simples de votos / upvotes)
   * Todos os usuários da mesma conta visualizam o mesmo feed de feedback

2. **Aba 2: Insights de Operação (Projetos/Tarefas/Clientes)**
   Objetivo: ser um feed interno de conhecimento, onde o time pode registrar insights sobre o trabalho em andamento.

   Exemplo de uso:

   * Insight sobre um **cliente** (ex.: “Cliente X odeia reunião de segunda de manhã, evitar esse horário”)
   * Insight sobre um **projeto** (ex.: “Campanha Y performou melhor com criativo Z, não repetir o outro formato”)
   * Insight ligado a uma **tarefa** específica (ex.: “Na próxima vez que fizer esse fluxo, lembrar de configurar tal coisa no GA4”)

   Requisitos iniciais (alta prioridade):

   * Criar posts com campos como:

     * Texto do insight (obrigatório)
     * (Opcional) imagem/print
     * Relacionamento com:

       * Cliente
       * Projeto
       * Tarefa
         (pelo menos um deles; idealmente permitir 1 cliente + 1 projeto + 1 tarefa quando fizer sentido)
   * Comentários em cada insight
   * Filtros básicos no feed:

     * Por cliente
     * Por projeto
     * Por tarefa
     * Por autor (usuário)
   * Ordem padrão do feed: mais recente primeiro
   * Todos os usuários da mesma conta visualizam o mesmo feed, respeitando o escopo da empresa/agência (multi-tenant no futuro).

---

## 3. Requisitos gerais e considerações

* O módulo **Central de Insights** deve ser só **um item na sidebar**, com duas abas internas (por exemplo: `Feedback do App` e `Insights de Operação`).
* Pensar no design de dados de forma que, no futuro, a aba de Insights possa também ser consumida em outras telas, por exemplo:

  * Na tela do Cliente 360: mostrar um “mini feed” com insights ligados àquele cliente.
  * Na tela de um Projeto: mostrar insights relacionados ao projeto.
  * Na tela de uma Tarefa: mostrar insights relacionados à tarefa.
* Precisamos de um modelo que funcione bem com **Firestore** (coleções, subcoleções, índices, etc.).
* Pensar em **controle de acesso** mínimo:

  * Usuários de uma mesma conta/agência veem os mesmos posts.
  * Não precisamos de permissões muito complexas nesse primeiro momento (pode considerar todos os usuários como nível “colaborador” com acesso total ao módulo).
* Não queremos construir uma “rede social completa” agora. Queremos algo **simples, funcional e escalável**, sem excesso de features (sem curtidas complexas, ranking, etc. nesse primeiro momento).

---

## 4. O que eu quero que você faça (escopo desta resposta)

NESTA PRIMEIRA RESPOSTA, **NÃO ESCREVA CÓDIGO**.
Quero que você atue como **arquiteto de software + tech lead** e entregue um **plano detalhado**, incluindo:

1. **Resumo do objetivo da funcionalidade**

   * Em até 5 bullets, explicar o propósito do módulo e das duas abas.

2. **Modelo de dados sugerido (nível conceitual + Firestore)**

   * Descrever as entidades principais (por exemplo: `InsightPost`, `FeedbackPost`, `Comment`, etc.).
   * Sugerir como modelar isso em termos de coleções e subcoleções do Firestore.
   * Explicar chaves importantes (ex.: `accountId`, `clientId`, `projectId`, `taskId`, `authorId`, `createdAt`, `updatedAt`, `type`, `status`, etc.).
   * Considerar índices que provavelmente serão necessários para os filtros principais.

3. **Fluxos de usuário (UX de alto nível)**

   * Descrever, em bullet points, os fluxos principais:

     * Criar um feedback de app
     * Atualizar status de um feedback
     * Criar um insight vinculado a cliente/projeto/tarefa
     * Filtrar insights por cliente/projeto/tarefa
     * Comentar em um post
   * Sem detalhar tela por tela, mas apontando componentes React típicos que seriam usados (formulário, lista, modal, etc.).

4. **Arquitetura de frontend (alto nível)**

   * Sugerir a estrutura de componentes React para o módulo Central de Insights e suas abas.
   * Explicar como você organizaria:

     * Componentes de página
     * Componentes de lista de posts
     * Componentes de formulário de criação/edição
     * Componentes de comentário
   * Fazer isso em formato textual (sem código), por exemplo:

     * `CentralInsightsPage`
     * `InsightsTab`
     * `FeedbackTab`
     * `PostList`
     * `PostForm`
     * etc.

5. **Roadmap técnico em fases**
   Sugerir um roadmap dividido em, por exemplo, **3 fases**, cada uma com entregas claras:

   * **Fase 1 – MVP do módulo**

     * Implementar o básico da aba Feedback do App
     * Implementar o básico da aba Insights de Operação
     * Sem funcionalidades avançadas (sem votos, sem mini-feeds em outras telas, etc.)

   * **Fase 2 – Refinamento e integração**

     * Adicionar votos “também quero” na aba Feedback do App
     * Integrar mini-feeds nas telas de Cliente/Projeto/Tarefa
     * Melhorar filtros

   * **Fase 3 – Escalabilidade e melhorias de UX**

     * Otimizar consultas e índices
     * Ajustar paginação, ordenação, e UX de filtros
     * Planejar futuras extensões (ex.: notificações, menções, etc.)

   Em cada fase, descrever **objetivo**, **principais tarefas** e **riscos/atenções**.

6. **Riscos e decisões em aberto**

   * Listar pontos que precisam de decisão do P.O. antes de codar (por exemplo: limites de anexos, regras de edição/exclusão, etc.).
   * Listar riscos técnicos (por exemplo: custo de leitura no Firestore, necessidade de índices compostos, etc.).

---

## 5. Formato da sua resposta

Responda em **Markdown**, bem organizado, com seções claras:

1. Visão geral
2. Modelo de dados
3. Fluxos de usuário
4. Arquitetura de frontend (alto nível)
5. Roadmap em fases
6. Riscos & decisões em aberto

Lembre-se: **não escreva código ainda**. Primeiro quero garantir que o desenho da solução está sólido antes de partir para a implementação.
