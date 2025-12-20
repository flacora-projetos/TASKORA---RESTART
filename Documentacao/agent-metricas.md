# Guia de Metrica (Google/Meta) - Taskora

Este documento resume como consumir as rotas ja prontas do backend `saldos-meta-e-google` (projeto legado descrito em `Documentacao/taskora_google_meta.md`) para obter metricas de Google Ads e Meta Ads a partir do Taskora. Ele serve como referencia rapida para os parametros suportados, exemplos de requests e checklist de saude quando algo falhar.

> Sempre grave os IDs oficiais no cadastro do cliente (Firestore) e trate os dados externos apenas como alimentacao do cache interno, conforme registrado em `Documentacao/chat_novo.md` e `Documentacao/README_dev.md`.

## Hosts e autenticacao
- **Base URL**: `https://api-wviue4ksza-uc.a.run.app/api` (mesmo host usado pelos demais conectores).
- **Header**: `Authorization: Bearer <token>` usando `taskora-backend-bearer` (vide `Documentacao/taskora_google_meta.md`).
- **Timeout recomendado**: 15 s. Em caso de 429, aguarde alguns segundos antes do retry.
- **Formato das respostas**: `{ ok: boolean, data?: object, error?: { message, details? } }`.

## Parametros compartilhados
- `range`: window de datas. Valores comuns estao abaixo; qualquer valor customizado deve seguir `CUSTOM:AAAA-MM-DD:BBBB-MM-DD`.
  - Google Ads: `TODAY`, `YESTERDAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_MONTH`, `ALL_TIME`, `CUSTOM:YYYY-MM-DD:YYYY-MM-DD`.
  - Meta Ads: `today`, `yesterday`, `last_7d`, `last_30d`, `this_month`, `last_month`, `maximum`, `CUSTOM:YYYY-MM-DD:YYYY-MM-DD` (case-insensitive).
- `limit`: maximo 100 registros por chamada. Default 50.
- `loginCustomerId`: opcional em Google Ads (formato `1234567890`). Use quando precisar de MCC especifico.
- `level` (Meta): `campaign`, `adset` ou `ad`.

## Endpoints Google Ads
| Metodo | Rota | Descricao | Params chave | Quando usar |
| --- | --- | --- | --- | --- |
| GET | `/google/accounts` | Lista contas com status/saldo | `activeOnly` | Dropdowns e verificacoes rapidas |
| GET | `/google/accounts/explore` | Mesmas contas + avisos de erro | `activeOnly` | Diagnostico de acesso |
| **GET** | **`/google/accounts/:customerId/summary`** | Totais do periodo (impressoes, cliques, spend, conversoes) | `range`, `loginCustomerId` | Cards de resumo |
| **GET** | **`/google/accounts/:customerId/campaigns`** | Campanhas + KPIs agregados | `range`, `limit`, `orderBy`, `status`, `channelType`, `loginCustomerId` | Listas detalhadas/export |
| **GET** | **`/google/accounts/:customerId/insights`** | Top campanhas por spend/ctr/conversoes | `range`, `limit`, `loginCustomerId` | Destaques/alertas |

Observacoes:
- GAQL aceita ranges customizados amplos, mas o Google so retorna dados a partir do primeiro gasto da conta.
- Ordenacoes (`orderBy`) disponiveis: `cost`, `clicks`, `impressions`, `ctr`, `conversions`, `conversionValue`.
- `costMicros` vem sempre em micros; normalize para BRL dividindo por 1e6 antes de exibir no front.

## Endpoints Meta Ads
| Metodo | Rota | Descricao | Params chave | Quando usar |
| --- | --- | --- | --- | --- |
| GET | `/meta/accounts` | Lista contas com saldos atuais | - | Dropdowns/checagens |
| **GET** | **`/meta/accounts/:accountId/summary`** | Totais do periodo (spend, impres, clicks, ctr, actions) | `range` | Cards de resumo |
| **GET** | **`/meta/accounts/:accountId/campaigns`** | Insights por level (campaign/adset/ad) | `range`, `level`, `limit` | Listas detalhadas/export |
| **GET** | **`/meta/accounts/:accountId/insights`** | Top campanhas por spend/ctr/conversoes | `range`, `limit` | Destaques/alertas |

Observacoes:
- `accountId` deve incluir o prefixo `act_`.
- A Meta limita o intervalo maximo (preset `maximum` cobre ~37 meses). Para periodos maiores use a API oficial direta.

## Exemplos de uso (curl)
```bash
# Resumo Google Ads (ultimos 7 dias)
curl -H "Authorization: Bearer $TASKORA_BACKEND_TOKEN"      "https://api-wviue4ksza-uc.a.run.app/api/google/accounts/1234567890/summary?range=LAST_7_DAYS"

# Campanhas Meta por adset (ultimos 30 dias)
curl -H "Authorization: Bearer $TASKORA_BACKEND_TOKEN"      "https://api-wviue4ksza-uc.a.run.app/api/meta/accounts/act_123456789/campaigns?range=last_30d&level=adset&limit=50"
```

## Boas praticas para o modulo de clientes
1. **IDs confiaveis primeiro**: preencha `googleCustomerIds`, `metaAccountIds`, `ga4PropertyIds` e `pinterestAccountIds` diretamente no cadastro (Firestore). Nunca dependa da API para descobrir IDs em tempo real.
2. **Cache interno sempre ativo**: use `pnpm --filter @taskora/api directory:cache:sync` (ou o job agendado descrito em `Documentacao/seed_scheduler.md`) para manter `directory_clients` atualizado antes de consultar metricas.
3. **Mensagens amigaveis**: se `ok` vier `false` ou `totals` retornar `null`, mostre status "Servico indisponivel"/"IDs ausentes" usando as diretrizes de `Documentacao/linguagem_dashboard.md`.
4. **Logs**: armazene `range`, `accountId` e `error` no `client_metrics_status` sempre que uma chamada falhar; isso alimenta os alertas exibidos no dashboard.

## Checklist de diagnostico rapido
1. **Diretorio/Cache**: verifique se `directory_clients` possui o cliente e se o campo `ultimaSincronizacao` e recente. Reexecute o sync se estiver vazio.
2. **IDs obrigatorios**:
   - Google Ads: formato `123-456-7890` armazenado em `googleCustomerIds`.
   - Meta Ads: `act_123456789` em `metaAccountIds`; use tambem `businessId` quando disponivel.
3. **Permissoes**: confirme no projeto legado se a conta ainda esta ativa. Rotas podem retornar `403 PERMISSION_DENIED` quando a conta foi removida do MCC/BM.
4. **Range invalido**: ranges customizados fora do historico retornam `ok: true` com `totals: null`. Ajuste o periodo e repita.
5. **Rate limit**: respostas `429` indicam excesso de chamadas; aguarde e reprocessa.
6. **Ferramenta de probe**: use `pnpm --filter @taskora/api metrics:probe --client=<id> --platform=meta --range=last_30d` (ou `google`) para reproduzir o erro antes de abrir ticket.

## Relacao com outros conectores
- Este agente cobre Google/Meta. Para GA4 utilize o guia `Documentacao/GA4_taskora.md`.
- Todos os segredos e permissoes estao centralizados no projeto `dacora---tarefas` conforme `Documentacao/taskora_google_meta.md`.
- Qualquer mudanca de payload/endpoint deve ser registrada em `Documentacao/chat_novo.md` e refletida nas instrucoes do modulo de clientes.

## Proximos aprimoramentos (backlog interno)
1. Especificar essas rotas em OpenAPI e publicar no repo para import facil.
2. Adicionar cache Firestore/Redis para resumos e insights mais acessados.
3. Criar script `pnpm --filter @taskora/api metrics:sync` para persistir snapshots diarios direto no banco do Taskora.

Documento atualizado em 2025-11-13 para alinhar linguagem e expectativas do MVP.

