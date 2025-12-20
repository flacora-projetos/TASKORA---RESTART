# Roadmap de UX - Página Inicial (Dashboard)

Objetivo: transformar o dashboard em uma "central operacional" que qualquer PO ou analista entenda em segundos, com gráficos amigáveis e chamados claros para ação. Abaixo um plano dividido em blocos temáticos para execução gradual, sempre mantendo a linguagem indicada em `Documentacao/linguagem_dashboard.md`.

---

## 1. Cabeçalho executivo ("O que aconteceu hoje?")
- **Hero/KPIs principais**: cards large com Investimento total (últimos 7 dias), Resultados (conversões-chave Meta/Google/GA4), Clientes com IDs completos e Horas registradas na semana.
- **Contexto textual**: pequena linha abaixo explicando variação vs. período anterior (setas ↑/↓) e aviso de quando o último sync rodou.
- **CTA imediato**: botão “Ver clientes sem dados” apontando para a lista filtrada `/clients?status=active&hasIds=false`.

## 2. Gráficos de desempenho
- **Tendência combinada (linha ou área empilhada)**: spend x conversões por plataforma (Google, Meta, GA4 eventos) nos últimos 30 dias. Permitir esconder/somar cada plataforma.
- **Pizza de distribuição**: fatia de investimento por cliente top 5 (ou por plataforma) para visualizar onde está o esforço.
- **Heatmap de horas**: calendário semanal mostrando tempo registrado por dia (insight rápido de produtividade).
- **Componente técnico**: reaproveitar dados de `client-metrics` + `time-entries` agregados; preparar endpoints `/metrics/overview` e `/time-entries/summary?groupBy=day`.

## 3. Alertas & saúde das integrações
- **Painel “Atenção imediata”** em destaque, com até 3 cards:
  - Clientes sem ID Google/Meta/GA4.
  - Jobs com falha (directory-sync, metrics-sync, ga4-sync).
  - Clientes com métricas zeradas por mais de X dias.
- Cada card deve trazer CTA “Resolver agora” que abre modal/aba correspondente (ex.: `ClientsPage` com filtro).
- Backend: expor `/metrics/integrations/status` já existente + novo endpoint `/jobs/status` (pode reutilizar logs do Cloud Scheduler).

## 4. Operações & tarefas
- **Quadro de tarefas resumido**: top tarefas por status (atrasadas, concluídas hoje, criadas hoje) com link para o módulo Projetos.
- **Horas por projeto**: tabela pequena com coluna “Líder”, “Horas na semana”, “% da meta”.
- **CTA "Registrar horas"**: botão fixo que abre o modal já existente do TaskList (aproveitar o estado).

## 5. Foco em clientes
- **Ranking de clientes**: lista dos que mais consumiram investimento na semana vs. resultado. Mostrar badge “métricas ok / faltando dado”.
- **Pipe de onboarding**: kanban mini com Contato → Cadastro → IDs → Métricas (usando dados de `clients` + `client_integrations`).

## 6. UX/microcopy
- Reaplicar linguagem do guia em todos os textos (“Dados atualizados”, “Configuração pendente”).
- Informações técnicas (IDs, tokens) vão para tooltips ou modal “Ver detalhes técnicos”.

## 7. Fases de entrega
1. **Sprint 1 (rápido)**: Hero executivo + alertas + filtros/CTA; aproveitar dados existentes.
2. **Sprint 2**: gráficos (linha/pizza) + ranking de clientes (precisa de novas agregações).
3. **Sprint 3**: heatmap de horas + pipe de onboarding + callbacks dos jobs.

Cada sprint deve vir acompanhado de:
- ajustes na API (novos endpoints/resumos).
- testes (`pnpm --filter @taskora/api test`, `pnpm --filter @taskora/web test`).
- atualização em `Documentacao/chat_novo.md`.

---

## Dados/Endpoints necessários
- `/metrics/overview`: combinar Google/Meta/GA4 com ranges configuráveis.
- `/clients/summary` (novo): retorna contagem de ativos, com IDs, sem IDs, etc.
- `/time-entries/summary?groupBy=day`.
- `/jobs/status`: últimas execuções dos Jobs (usar Firestore ou Cloud Logging).

Com esse plano, conseguimos transformar o dashboard em uma página “viva”, rica em gráficos e com ações claras, sem excesso de jargão técnico. Cada bloco pode ser tratado como uma história/sprint, permitindo validar com o PO antes do rollout final.
---

## Sprint 3 - andamento (2025-11-17)
- **Tendencia de horas**: hook `useHoursTrend` + card `HoursTrendCard` consultam `/reports/hours?groupBy=day` para mostrar 14 dias de produtividade com micrografico e CTA para o modulo de Projetos.
- **Jobs/automacoes**: `JobsStatusCard` passou a ser renderizado no dashboard, reaproveitando `/maintenance/jobs/status` (env `TASKORA_JOBS_STATUS`) com fallback amigavel quando nao ha agendamentos.
- **Layout**: `DashboardShell` organiza Spend Overview, Tendencia de horas e Jobs no mesmo bloco, alinhando o roadmap da secao "Operacoes & tarefas".
- **Pipe de onboarding**: backend expôs `GET /clients/summary` (funil + destaques) e o card `ClientOnboardingCard` foi adicionado ao dashboard com CTA para `/clients`.
