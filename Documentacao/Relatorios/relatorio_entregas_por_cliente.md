# Relatorio de entregas por cliente

## Objetivo
Relatorio que agrupa tarefas concluidas por cliente dentro de um periodo, com filtros de tipo e exportacao CSV/PDF. Sempre respeita o orgId ativo (multi-tenant).

## Endpoint (JSON)
GET /reports/tasks-by-client

Query:
- periodStart (YYYY-MM-DD ou ISO)
- periodEnd (YYYY-MM-DD ou ISO)
- mode (summary | all) - default summary
- types (opcional, lista separada por virgula). Quando enviado, substitui o modo.

Regras:
- Apenas tarefas com status done.
- Data de conclusao e obtida do ultimo status_change para done (activityLog). Fallback: updatedAt.
- Tarefas sem clientId (via projeto) sao ignoradas.

Resumo de tipos (summary):
- report
- feedback
- billing
- meeting

## Endpoint de exportacao
GET /reports/tasks-by-client/export

Query:
- periodStart, periodEnd, mode, types
- format (pdf | csv)

Retorna arquivo com Content-Disposition (download).
Nome do arquivo: `Relatorio-de-Entregas_{orgSlug}_{YYYY-MM-DD}_modo-{summary|all}.pdf` (ou `.csv`).

## Formato da resposta (JSON)
- orgId, orgName, orgSlug
- period { start, end }
- mode
- filters { types }
- generatedAt
- totals { clients, tasks }
- clients[] { clientId, clientName, tasks[] }
- tasks[] { id, title, description, type, completedAt, projectId, projectName, assignees[] }

## PDF
- Cabecalho com logo da org quando disponivel, titulo do relatorio e metadados (organizacao, periodo, modo, tipos).
- Blocos por cliente com resumo por tipo e separador visual entre clientes.
- Cada tarefa: linha com data (dd/MM/yyyy), tipo e titulo; projeto e responsaveis em linhas dedicadas.
- Observacoes truncadas (ate 3 linhas) com marcador "[...]" e links exibidos como labels curtas (max 3).
- Cabecalho e rodape em todas as paginas com paginacao e data de geracao.

Logos usados:
- Dacora: apps/api/src/assets/org-logos/dacora.png (usa o arquivo 2.png)
- Allgrotech: apps/api/src/assets/org-logos/allgrotech.png
- Narah: sem logo (usa apenas o nome da org)
