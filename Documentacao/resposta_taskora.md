# MVP Taskora (Nov/2025)

## Stacks Comparadas
| Stack | Prós | Contras | Custos/Maturidade | Integração Firebase/GCP |
| --- | --- | --- | --- | --- |
| Opção A – Node.js/TypeScript | Ecossistema vasto, DX rápida, mesmas linguagens front/back, SDK Admin oficial | Necessita disciplina para tipagem e arquitetura | Cloud Run + Firestore ~US$120-180/mês no cenário atual; equipe JS abundante | SDK Firebase Admin maduro, Firestore/Storage/Auth nativos, Cloud Tasks/Logging prontos |
| Opção B – Python/FastAPI | Produtividade alta, ótima para protótipos, ecossistema analítico | Menor performance por request, tipagem opcional | Custos similares, porém exige tuning de cold start | SDKs Firebase razoáveis, Firestore/Storage suportados, Pub/Sub via libs oficiais |
| Opção C – Go | Runtime leve, ótima concorrência, binários estáticos | Curva de aprendizado maior no time; menos libs prontas | Menor custo computacional (~10-15% abaixo) | SDK Admin oficial, Firestore/Storage ok; ecossistema front/back separado |
| Opção D – Java/Kotlin (Spring/Ktor) | Robustez, tooling corporativo, forte em RBAC e testes | Peso inicial maior, cold start maior no Cloud Run | ~US$300-400/mês; hiring mais caro | Firebase Admin Java sólido, porém com mais boilerplate |

**Recomendação:** Opção A — Node.js/TypeScript. Maximiza velocidade de entrega, aproveita talento disponível, SDK Firebase completo e custos previsíveis. Permite migração futura para Cloud SQL via Prisma se necessário.

## Ajustes para Escopo Atual
- Escopo inicial: 3 usuários internos e ~40 clientes ativos com até 3 integrações cada, permitindo dimensionar Cloud Run para `minInstances=0` e Firestore no tier gratuito/pago mínimo (estimativa ~US$120-180/mês).
- Controle de horas via lançamento manual (sem cronômetro); elimina dependência de Cloud Tasks idempotentes e simplifica UX.
- Automação assíncrona focada apenas em lembretes e geração de relatórios (Cloud Scheduler → Cloud Run Jobs pontuais).
- Modelagem multi-tenant e RBAC permanecem, mas regras podem ser simplificadas para roles essenciais (gestor/analista).

## Arquitetura Detalhada
- Frontend Next.js em Firebase Hosting (SSR opcional via Cloud Run), CI/CD com GitHub Actions → Cloud Build.
- API/BFF Node.js (Express ou Fastify + TypeScript) em Cloud Run, autenticação via Firebase Auth + claims customizadas; multi-tenant garantido por `organizationId` em todos os acessos.
- Firestore como repositório principal (coleções particionadas `organizations/{org}/...`), Cloud Storage para anexos, Secret Manager para segredos.
- Cloud Scheduler + Cloud Run Jobs (ou Tasks) apenas para lembretes e conciliações pontuais, sem cronômetro contínuo.
- Observabilidade com Cloud Logging, Error Reporting, Cloud Monitoring (dashboards), traces via OpenTelemetry exporter.
- Auditoria persistida em coleção `audit_logs` e exportada para BigQuery.

## Modelo de Dados
| Entidade | Campos principais | Índices/Observações |
| --- | --- | --- |
| organizations | nome, domínio, plano, settings, softDelete | Índice por domínio; referência para limites do tenant |
| users | displayName, email, roles, status, orgIds | Índice composto email+org; claims do Firebase Auth |
| clients | orgId, nome, segmento, budget, driveLink, whatsappGroup | Índice orgId+nome; integrações referenciadas |
| projects | clientId, templateId, status, startDate, endDate, ownerId | Índice status+dueDate; cálculo por responsável |
| tasks | projectId, title, type, status, assignees[], dueDate, checklist | Índice assignees+status; subtarefas em coleção própria |
| task_templates | orgId, title, checklist[], defaultDurations | Índice orgId+title; base para criação de projetos |
| time_entries | taskId, userId, date, reportedMinutes, notes | Índice userId+date; validação manual (sem timer) |
| optimizations | taskId/projectId, date, action, expectedResult, impact | Índice projectId+date; suporte a relatórios |
| notes | scope(project/task), authorId, content, createdAt | Índice scopeId+createdAt; paginação cronológica |
| access_integrations | clientId, platform, accountId, status, credentialsRef | Segredos via Secret Manager |
| reports | orgId, type, period, url, generatedAt | Suporte a Looker/Data Studio |
| audit_logs | actorId, orgId, action, resource, diffSnapshot, timestamp | Exportação BigQuery para retenção longa |

## Contrato de API (REST)
| Método | Endpoint | Descrição | DTO chave |
| --- | --- | --- | --- |
| POST | /auth/exchange-token | Recebe token Firebase e retorna JWT com roles/tenant | `{ firebaseToken } → { accessToken, expiresIn, roles }` |
| GET | /organizations/{orgId}/clients | Lista clientes paginados e filtrados | Query `status`, `q`, `pageSize`; resposta `{ items[], nextPageToken }` |
| POST | /projects | Cria projeto com base em template | `{ clientId, templateId, startDate, ownerId }` |
| PATCH | /tasks/{taskId} | Atualiza status/checklist | `{ status?, checklistItemId?, value? }` |
| POST | /time-entries | Cria registro manual de horas trabalhadas | `{ taskId, date, reportedMinutes, notes? }` com validações básicas |
| GET | /projects/{projectId}/timeline | Retorna notas, otimizações e logs auditados | `{ events: [{ type, sourceId, author, timestamp, payload }] }` |
| GET | /reports/hours | Consolida horas por cliente/projeto/colaborador | Query `clientId`, `period`; resposta `{ summary, byProject[], byUser[] }` |

## Plano de Sprints (4 semanas)
| Semana | Foco | Entregáveis |
| --- | --- | --- |
| 1 | Fundamentos & Infra | Monorepo TypeScript, lint/test, Terraform (Firestore, Storage, Auth, Secret Manager, Cloud Run), pipeline GitHub Actions → Cloud Build, ADRs iniciais |
| 2 | Auth & Clientes | Login Firebase, exchange token API, RBAC middleware, CRUD organizations/clients/integrations, seed inicial, Firestore rules base |
| 3 | Projetos/Tarefas & Horas Manuais | CRUD projetos/tarefas/subtarefas, templates, registro manual de horas, timeline (notas/logs), OpenAPI v1 |
| 4 | Relatórios & Observabilidade | Relatório horas/otimizações, auditoria e export BigQuery, dashboards Monitoring, testes integração críticos, deploy ambiente demo, documentação completa (README, setup, ADRs, plano Fase 2) |

## Migração Firestore ↔ Cloud SQL
- Implementar camada de repositórios com interfaces para permitir alternância do backend.
- Exportar periodicamente Firestore → BigQuery → Cloud SQL (Dataflow) para backfill histórico.
- Em migração, ativar escrita dupla via feature flag e monitorar divergências.
- Planejar cutover com validação (checksums, testes de contrato) e freeze curto de escrita.

## Riscos e Mitigação
| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Vazamento cross-tenant | Alto | Claims Firebase + filtros `orgId` em todas as queries + testes multi-tenant |
| Limites Firestore (1MB doc / 1k writes/s) | Médio | Modelagem enxuta, sharding por `orgId`, relatórios pesados via BigQuery |
| Confiabilidade do registro manual | Médio | UX simples (pré-preenchimento por tarefa), validações de total diário, relatórios de revisão semanal |
| RBAC inconsistente entre Auth e API | Médio | Fonte única `userRoles` em Firestore, sync automático com custom claims |
| Custos Cloud Run ociosos | Baixo | `minInstances=0` em dev/stage, alertas de budget, métricas de consumo |
| Reuso de projeto GCP existente | Médio | Usar projeto atual apenas se ambientes estiverem isolados (buckets, contas de serviço, quotas). Para MVP recomendado criar projeto dedicado `taskora-dev` + `taskora-prod` no Blaze, mantendo billing compartilhado porém recursos segregados |

## Checklist de Aceitação
| Critério | Verificação |
| --- | --- |
| Login/Logout + RBAC | Fluxo e2e com Firebase Auth, roles validadas em testes de integração |
| CRUDs performáticos | Endpoints com paginação (`pageSize <= 50`), p95 monitorado < 300 ms |
| Registro de horas & relatórios | Lançamento manual em `time-entries`, relatório `/reports/hours` validado |
| Timeline/logs | `timeline` agrega notas, otimizações, auditoria com paginação |
| CI/CD & Deploy | Pipeline executa lint/test/build/deploy; ambiente demo ativo |
| Documentação | README, guia setup, OpenAPI publicado, ADRs, plano Fase 2 incluído |

## Validação Frontend Pré-Deploy
- **Qualidade automatizada:** lint (`eslint`, `stylelint`) e testes unitários (`jest`/`react-testing-library`) em cada PR, bloqueando merges que falharem.
- **Testes de integração UI:** execução de suíte Playwright/Cypress direcionada aos fluxos críticos (login, CRUD cliente/projeto, lançamento de horas), rodando em pipeline com Firebase Emulator + mock de Firestore.
- **Preview em ambiente isolado:** GitHub Actions publica previews no Firebase Hosting (canal de preview) para checagem visual e validação de RBAC com usuários de teste.
- **Checklist manual leve:** antes do deploy para produção, revisão smoke (3 usuários, 2 clientes, lançamento de horas, relatórios) registrada em issue ou checklist no repositório.
- **Gate de aprovação:** deploy para canal `prod` apenas após aprovação do responsável de QA/gestor no pipeline, garantindo que a versão validada seja a mesma publicada.

## Observação
Planejar expansão mobile via Flutter (Dart) mantendo backend no Cloud Run/Firebase para reaproveitar Auth e Firestore quando o roadmap considerar.

## Projeto GCP/Firebase
- Projeto escolhido: `dacora---tarefas` tanto no Firebase quanto no GCP. Ajustar o contexto do CLI antes de provisionar (`gcloud config set project dacora---tarefas` e `firebase use dacora---tarefas`).
- Revisar e limpar serviços já criados (Auth, Firestore, Storage) — exportar dados relevantes e remover coleções/buckets antigos para iniciar com ambiente limpo.
- Controlar ambientes lógicos via namespaces ou coleções separadas (`env: dev/prod`), mantendo o mesmo projeto Blaze; se surgir necessidade de isolamento físico, criar projeto adicional posteriormente.
- Utilizar contas de serviço específicas do projeto nas pipelines Terraform/CI para evitar dependências de credenciais legadas.
