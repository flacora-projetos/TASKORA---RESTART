# Prompt para o Codex – Introduzir Organizações (multi-tenant) no Taskora

Você é o dev sênior deste projeto **Taskora**, um painel operacional para agência de marketing digital, feito em **React + Firebase/Firestore + Cloud Run**, já com módulos de Clientes, Projetos, Tarefas, Horas, Histórico de tarefas, Métricas de mídia, Central de Insights e Assistente Gemini.

Nesta tarefa você NÃO é P.O., você é **tech lead**. O P.O. sou eu.

---

## 1. Contexto do problema

Hoje o Taskora foi pensado, na prática, como se existisse **uma única empresa/agência** usando o sistema. Na vida real, porém, eu preciso separar os dados em **múltiplas organizações** (multi-tenant leve):

- **Organização 1 – Dácora**  
  É a agência principal. Já existem clientes, projetos, tarefas, horas, histórico etc. **Todos os dados atuais pertencem à Dácora.**

- **Organização 2 – Allgrotech**  
  É uma agência parceira. A Dácora faz só o tráfego pago para ela, mas ela tem **clientes próprios** que eu atendo via Taskora. Precisamos separar isso de forma que, no futuro, o pessoal da Allgrotech possa acessar o Taskora de forma segura, vendo apenas os dados deles.

- **Organização 3 – Narah Lopes**  
  São clientes meus individuais, fora da Dácora. Quero atendê-los numa organização separada.

Eu (mesmo usuário Firebase) preciso conseguir acessar as **3 organizações**, mudando de contexto dentro do app (tipo um selector de organização), sem misturar dados entre elas – ou por algum outro fluxo simples que você sugerir, como escolha de organização logo após o login.

---

## 2. Objetivos da feature

Quero que você desenhe uma solução para:

1. Introduzir o conceito de **Organização** (ou `Account`, `Workspace`, etc.) no backend (Firestore) e na aplicação.
2. Garantir que **clientes, projetos, tarefas, horas, histórico, insights, métricas, etc.** passem a estar sempre associados a uma organização (`orgId`).
3. Permitir que **um mesmo usuário Firebase** pertença a uma ou mais organizações, com um contexto de organização ativa (`activeOrgId`).
4. Implementar um fluxo simples de **troca de organização** na UI (provavelmente um seletor no topo/side bar), que recarrega os dados filtrando pela organização ativa.  
   Também quero que você discuta a alternativa de um fluxo em que o superusuário (eu) faz um cadastro prévio de membros em cada organização, e ao logar o usuário já cai direto na organização à qual pertence (sem precisar escolher) quando ele só tem uma. Explique prós e contras de cada abordagem e indique qual faz mais sentido para o momento atual do projeto.
5. **Não quebrar** os módulos que já existem e manter o app usável durante a transição.

Por enquanto, não precisamos de RBAC complexo (roles detalhados). Pode assumir que todo usuário listado em uma organização é colaborador com acesso total àquela org.

---

## 3. Requisitos técnicos e de dados

Alguns pontos que eu quero que você considere no desenho da solução:

- Banco: **Firestore** já em uso.  
- Entidades atuais relevantes (nomes podem variar, use os reais do código):
  - Clientes
  - Projetos
  - Tarefas
  - Horas (time entries)
  - Histórico de tarefas
  - Registros de métricas / integrações
  - Posts da Central de Insights

### 3.1. Organização e membership

Quero que você proponha um modelo com, por exemplo:

- Uma coleção de `organizations` (ou nome equivalente).
- Alguma forma de mapear **usuário ↔ organização**:
  - Subcoleção `members` dentro de `organizations`, ou
  - Coleção de junção `userOrganizations`, etc.
- Campo `orgId` nas entidades que forem multi-tenant.

### 3.2. Consultas e segurança

- Todas as consultas de dados de domínio (clientes, projetos, tarefas, etc.) precisam passar a respeitar o `activeOrgId`.
- Security rules do Firestore devem impedir que um usuário acesse dados de uma organização da qual não é membro.
- Precisamos ter cuidado com índices compostos necessários para consultas filtrando por `orgId` + outros campos (status, cliente, datas, etc.).

### 3.3. Migração dos dados atuais

- Assuma que **todos os dados atuais pertencem à organização Dácora**.
- Precisamos de uma estratégia de migração para adicionar `orgId` a todos os documentos relevantes, sem corromper nada.
- Isso pode ser via script (Cloud Run/CLI) ou função temporária. Eu quero que você proponha a abordagem.

---

## 4. O que eu quero NESTA FASE

Nesta primeira fase, NÃO quero que você saia refatorando tudo direto. Primeiro quero um **plano técnico claro**, depois a gente parte para a implementação em outra etapa.

Então, nesta resposta, faça o seguinte, em **Markdown e em português (pt-BR)**:

1. **Visão geral da solução**  
   - Em poucos parágrafos, explique como você enxerga o modelo multi-tenant no Taskora (organização, membership, orgId em entidades, seletor de organização na UI, etc.).

2. **Modelo de dados proposto**  
   - Descreva as coleções principais (ex.: `organizations`, `organizationMembers`, etc.).
   - Liste explicitamente quais entidades precisarão de campo `orgId` e se há algum caso que NÃO precisa.
   - Fale sobre impactos em índices (quais consultas típicas vão precisar de índice com `orgId`).

3. **Fluxo de autenticação + contexto de organização**  
   - Explique como, após o login, o app deve:
     - buscar as organizações do usuário,
     - definir uma `activeOrgId` padrão (ex.: última usada ou primeira da lista),
     - disponibilizar isso num contexto global (React context, Zustand, etc. – use o que já estiver no projeto), e
     - garantir que todas as hooks/services que acessam Firestore recebam/considerem esse `activeOrgId`.

4. **Troca de organização na UI**  
   - Descrever como você adicionaria um seletor de organização na interface (onde ficaria, como funcionaria, estados de loading, etc.).
   - Como a troca de organização impacta as telas (por exemplo: resetar filtros, refazer queries, limpar caches em memória).

5. **Plano de migração dos dados atuais**  
   - Propor um passo a passo para:
     - criar a organização Dácora,
     - associar o usuário atual como membro,
     - atualizar todos os documentos existentes com `orgId = Dacora`,
     - validar que nada quebrou.

6. **Roadmap de implementação em etapas**  
   - Sugira um roadmap em 2 ou 3 fases de implementação (por exemplo: Fase 1 = criar modelos/coleções e contexto; Fase 2 = adaptar módulos críticos; Fase 3 = migração completa e limpeza de código legado).

7. **Riscos e pontos de atenção**  
   - Liste os principais riscos (ex.: esquecer algum módulo sem `orgId`, consultas sem filtro, aumento de custo de leitura, complexidade em regras de segurança).
   - Aponte qualquer decisão que você precise que eu, como P.O., tome antes da implementação.

---

## 5. Estilo da resposta

- Seja direto e pragmático, mas detalhado o suficiente para que a implementação posterior seja quase mecânica.
- NÃO escreva código ainda – apenas planejamento técnico estruturado.
- Responda em **pt-BR** e use seções e listas em Markdown para facilitar minha leitura.

