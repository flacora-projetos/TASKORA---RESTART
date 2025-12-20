Prompt para Agente Desenvolvedor (GCloud + Firebase)
Contexto do Produto

Somos uma operação de tráfego digital e precisamos de um sistema interno para gestão de clientes, projetos/tarefas, horas, comunicação interna, histórico de otimizações e equipe. O sistema deve ser multi-tenant, seguro (RBAC), com logs de auditoria e integração nativa ao ecossistema Google Cloud e Firebase.

Objetivo

Projetar e implementar um MVP robusto com arquitetura escalável, CI/CD e observabilidade, cobrindo os módulos abaixo.

Módulos e Requisitos Funcionais

Central de Clientes

Cadastro: nome, segmento, orçamento mensal, plataformas (Google/Meta/TikTok…), link do Drive, grupo de WhatsApp.

Acessos/Integrações: IDs/logins de Ads, Analytics, Merchant, Tag Manager; status (pendente/ativo).

Briefing/Diagnóstico: empresa, produtos, público, metas, criativos, observações.

Histórico de Relacionamento: timeline de reuniões, feedbacks e relatórios.

Gestão de Projetos e Tarefas

Hierarquia: Cliente → Projeto → Tarefas → Subtarefas.

Templates de tarefas (setup, execução, otimização, relatório) com checklists.

Status: pendente, em andamento, em revisão, finalizado; prazos e alertas.

Atribuição de responsáveis; relatórios por responsável.

Controle de Horas e Produtividade

Registro de horas (cronômetro embutido e input manual).

Relatórios por cliente/projeto/colaborador.

Alertas de desvios (tempo esperado vs. real) e base para cálculo de custo-hora/margem.

Exportação para contabilidade/precificação.

Histórico e Comunicação Interna

Linha do tempo por projeto (quem/quando/o quê), comentários por tarefa/projeto.

Log de Otimizações: data, ação (orçamento, público, criativo, copy), resultado esperado.

Relatórios vinculados (Looker/Data Studio/Sheets/PDFs).

Cadastro e Gestão de Funcionários

Perfil: nome, função, e-mail, nível de acesso (gestor/analista/suporte).

Associação a clientes e projetos; dashboard individual (tarefas, horas, status).

Métricas de desempenho: produtividade, tempo médio, retrabalho.

Requisitos Não Funcionais

Segurança: RBAC, OAuth2/Firebase Auth, MFA opcional, hashing de senhas, OWASP ASVS.

Dados: multi-tenant (por organização/cliente), migrações, soft delete, versionamento de registros sensíveis.

Logs & Observabilidade: Cloud Logging, Error Reporting, métricas (Uptime Checks, Cloud Monitoring).

Performance: p95 de API < 300 ms no MVP; paginação/consulta indexada.

Escalabilidade: pronta para escalar horizontalmente (Cloud Run/Functions, Firestore/Cloud SQL).

Backups & DR: políticas de backup diárias, RPO ≤ 24h, RTO ≤ 4h.

Compliance: LGPD (BR) — consentimento, minimização de dados, direitos do titular.

Integrações (Fase MVP)

Google Ads/Analytics/Tag Manager (armazenar IDs e status; chamadas reais podem ficar para Fase 2).

Google Drive (links e permissões).

Webhooks/Jobs para sincronizações futuras.

Arquitetura (esperada)

Frontend: SPA responsiva (dashboard, Kanban, formulários, timesheets).

Backend: APIs REST (ou GraphQL se justificável) com autenticação e autorização.

Jobs: Cloud Scheduler + Cloud Tasks para tarefas assíncronas (alertas, lembretes).

Armazenamento: Firestore (ou Cloud SQL se modelo relacional superar limites), Cloud Storage para anexos, Secret Manager.

Hospedagem: Cloud Run (preferencial) ou Firebase Hosting (frontend).

Esquema/Domínio (alto nível)

organizations (tenant), users, clients, projects, tasks, task_templates, time_entries, optimizations, notes, access_integration, reports.

Relacionamentos: organization 1-N clients; client 1-N projects; project 1-N tasks; task 1-N time_entries/notes/optimizations; user N-N projects via assignments.

Fluxos Principais

Onboarding do cliente → cadastro + briefing + acessos.

Criação de projeto com template de tarefas.

Atribuição de responsáveis, execução, registro de horas e otimizações.

Monitoramento com logs/timeline, alertas e relatórios.

Encerramento e consolidação.

Entregáveis Solicitados

Proposta de Stack (ver seção “Sua Tarefa 1”).

Arquitetura detalhada (diagrama + decisões: API, dados, auth, deploy).

Esquema de dados inicial (coleções/tabelas + índices).

Contrato de API (OpenAPI/Swagger ou SDL se GraphQL).

MVP funcional com:

Autenticação (Firebase Auth/OAuth2), RBAC e multi-tenant.

CRUD completo dos módulos-chave.

Timesheet/cronômetro e relatórios básicos.

Logs de auditoria.

CI/CD via Cloud Build ou GitHub Actions (deploy para Cloud Run/Hosting).

Infra as Code (Terraform preferencialmente) para ambientes: dev/stage/prod.

Testes: unitários (≥70% nas camadas críticas), integração para endpoints principais.

Observabilidade configurada (dashboards + alertas).

Documentação: README, guia de setup local, ADRs (Architecture Decision Records) e plano de evolução (Fase 2).

Critérios de Aceitação

Login/Logout com permissões por papel e isolamento de tenant.

CRUDs performáticos, com validações e paginação.

Registro de horas (timer e manual) e relatórios por cliente/projeto/colaborador.

Timeline/logs por projeto e log de otimizações consultável.

Deploy automatizado em ambiente cloud e documentação atualizada.

Sua Tarefa 1 — Recomende a Linguagem/Stack (compatível com GCloud/Firebase)

Apresente 3 a 4 opções de stack com prós/contras, maturidade no Google Cloud, integração com Firebase e exemplos de serviços usados. Inclua sua recomendação final:

Opção A (Node.js/TypeScript)

Hospedagem: Cloud Run/Functions

Auth: Firebase Auth

Dados: Firestore (ou Cloud SQL via Prisma)

Front: React/Next.js no Firebase Hosting

Observabilidade: Cloud Logging/Trace

Opção B (Python/FastAPI)

Hospedagem: Cloud Run/Functions

Dados: Firestore/Cloud SQL (SQLAlchemy)

Front: React/Next.js

Opção C (Go)

Hospedagem: Cloud Run

Dados: Firestore/Cloud SQL

Front: React/Next.js

Opção D (Java/Kotlin – Spring Boot/Ktor)

Hospedagem: Cloud Run

Dados: Cloud SQL/Firestore

Front: React/Next.js

Para cada opção, detalhe:

Custos operacionais estimados (ordem de grandeza para MVP), facilidade de hiring, velocidade de entrega e DX.

Compatibilidade/SDKs com Firebase Admin, Firestore, Auth, Cloud Storage, Pub/Sub, Secret Manager.

Trade-offs entre Firestore vs. Cloud SQL para nosso modelo.

No final, escolha 1 stack recomendada, justificando com: time-to-market, manutenibilidade, curva de aprendizado, custos e aderência a Firebase/GCloud.

Sua Tarefa 2 — Plano de Implementação (2–4 semanas para MVP)

Quebre em sprints com metas claras (setup cloud, auth+RBAC, CRUDs essenciais, timesheets, relatórios, observabilidade).

Entregue os artefatos de infra (Terraform), pipeline CI/CD, OpenAPI, seed de dados e ambiente demo.

Inclua plano de migração de Firestore ↔ Cloud SQL caso o domínio se torne mais relacional.

Formato de Resposta Esperado

Stacks comparadas (tabela curta + recomendação final).

Arquitetura detalhada (diagrama explicativo e decisões-chave).

Modelo de dados (entidades, campos principais, índices).

Contrato de API (exemplos de endpoints/DTOs ou schema GraphQL).

Plano de sprints e cronograma.

Lista de riscos e mitigação (multi-tenant, cotas do Firestore, locking de timer, etc.).

Checklist de aceitação mapeado aos critérios acima.

Observação: se considerar pertinente, pode sugerir Flutter (Dart) para um app mobile futuro (Firebase-friendly), mantendo o backend no Cloud Run.