# Visão geral do Taskora

Documento para uso em materiais de adoção (Notebook LM): foco no que o app faz, como usar e para que serve.

## O que é
Taskora é um painel operacional para uma agência acompanhar clientes, projetos, tarefas, horas e métricas de mídia. Une fluxo de trabalho (tarefas/horas), saúde das integrações (Meta/Google/GA4/Pinterest) e um assistente Gemini que executa ações e responde perguntas usando os dados internos.

## Principais módulos e funcionalidades

- **Autenticação e acesso**  
  Login Google/Firebase; perfis com papéis (gestor/analista/suporte) determinam o que pode ser visto ou criado.

- **Clientes**  
  Cadastro e status (ativo/arquivado), responsável interno, segmento, integrações vinculadas. Filtros por status/plataforma/segmento/responsável. Visão rápida de pendências de IDs e onboarding.

- **Projetos**  
  Projetos por cliente, com status ativo/arquivado. Usados como contêiner para tarefas e horas. Filtros por cliente/status.

- **Tarefas**  
  Lista consolidada de tarefas do org: título, cliente, projeto, responsáveis, plataformas, prazo, status (backlog, a fazer, em andamento, bloqueada, revisão, concluída), tipo (otimização, relatório, criativo, reunião, outros). Filtros rápidos por status, responsável, cliente, projeto, plataforma e período (hoje/semana/mês/últimos 7/30/custom). Cards de Hoje/Semana/Atrasadas e badges de prioridade. Ao concluir, abre modal para registrar horas. Cards mostram nome do projeto e cliente.

- **Horas (time entries)**  
  Registro de minutos/hora trabalhada por tarefa/projeto/usuário/data/notas. Modal de horas na conclusão da tarefa e edição posterior. Relatório de horas por intervalo de datas, com filtros por projeto/usuário.

- **Histórico de tarefas**  
  Timeline com filtros em 3 colunas: cliente/projeto/responsável; tipo de evento (criação, status, prazo, prioridade, horas, relatório, reunião, etc.); período rápido ou custom. Export CSV/PDF. Cards exibem nomes legíveis de tarefa/projeto/cliente e origem amigável (manual/API/MCP). IDs brutos ocultos.

- **Métricas e integrações**  
  Resumo operacional com contas Google Ads/Meta Ads/GA4/Pinterest vinculadas aos clientes. Cards de gastos, saldo pré-pago, limite, alertas de integração e status dos jobs de sincronização. Filtros de plataforma e visualizações de resumo/insights (melhores campanhas).

- **Assistente Gemini**  
  Painel lateral que entende contexto do org e usa tools internas:  
  - Cria tarefas em projetos ativos (lista projetos numerados, pede título/prazo/responsável).  
  - Responde sobre tarefas (atrasadas, para hoje, por responsável/cliente).  
  - Consulta horas do dia e histórico de eventos.  
  - Resuma gastos/insights de Meta/Google/GA4 usando apenas contas do cliente em foco.  
  - Verifica status de integrações.  
  Interação: Enter envia, Shift+Enter quebra linha. Se faltar informação, ele pergunta (slot-filling). Não inventa IDs/datas; só usa dados de contexto.

- **Dashboard**  
  Hero com KPIs de clientes/projetos, cards de horas do dia, saldos/pre-pago, alertas de integrações, tendências de horas, status de jobs e onboarding de clientes. CTA para abrir tarefas e integrações.

- **Integrações adicionais (Pinterest MCP)**  
  Conexão de contas Pinterest por cliente, status no card de integrações, coleta de métricas (spend, impressões, cliques, conversões) via agente.

## Casos de uso rápidos
- **Planejamento diário:** ver cards Hoje/Atrasadas e filtrar tarefas por responsável para priorizar.  
- **Fechamento:** concluir tarefa, registrar horas e gerar relatório de horas por intervalo.  
 - **Follow-up de cliente:** abrir histórico filtrando por cliente + tipo de evento (relatório/reunião) e exportar PDF.  
- **Mídia paga:** pedir ao assistente “resuma Meta/Google do cliente X últimos 7 dias” ou “melhores campanhas na Meta” (ele usa contas cadastradas).  
- **Criação de tarefa via chat:** “Criar tarefa para cliente Y” → ele lista projetos numerados, pergunta título/prazo/responsável e cria.  
- **Saúde das integrações:** conferir cards de status (Meta/Google/GA4/Pinterest) e os jobs de sincronização.

## Boas práticas de uso
- Sempre escolha projeto e cliente corretos ao criar tarefas para manter histórico e métricas coerentes.  
- Registre horas ao concluir tarefas; use notas breves.  
- No assistente, forneça cliente/projeto quando pedir ações; responda ao número do projeto listado para evitar ambiguidades.  
- Para métricas, peça períodos claros (ex.: “últimos 7 dias”, datas específicas) e o assistente usará os IDs existentes.  
- Use filtros de período e evento no histórico antes de exportar CSV/PDF para relatórios rápidos.

