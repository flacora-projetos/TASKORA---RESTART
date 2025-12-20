# Guia operacional  GA4 Cloud Run (MCP, Taskora e demais clientes)

## Resumo imediato
| Item | Valor |
| --- | --- |
| Servico | Cloud Run `agente-ga4-api` (`gmail-credentials-474123`, regiao `us-central1`) |
| Base URL | `https://agente-ga4-api-860407662159.us-central1.run.app` |
| Tokens ativos | `ga4-internal-token` (legado)  `taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9` (MCP/Taskora) |
| Ultimo deploy | 2025-11-08 08:59 (-03) via pipeline `gcloud run deploy agente-ga4-api` (build `712b8d3d-4b63-4753-90d5-5e59d46e8198`) |
| Ultimo teste end-to-end | 2025-11-08 09:11 (-03)  sequencia automatizada de chamadas HTTPS (lookup, runReport, runPivotReport, batchRunReports, batchRunPivotReports, runRealtimeReport, checkCompatibility) usando ambos os tokens – todas retornaram `ok: true`. |

---

## 1. Endpoint e autenticacao

- Todas as rotas expostas ficam sob `/ga4/*`.
- Cabecalho obrigatorio: `x-internal-token: <um dos tokens validos>`.
- Tokens e uso recomendado:

| Token | Uso principal | Observacoes |
| --- | --- | --- |
| `ga4-internal-token` | GPTs internos, scripts de suporte | Mantido por compatibilidade. |
| `taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9` | Taskora / MCP | Armazenar no Secret Manager (`mcp-ga4-taskora`). Tambem pode ser usado para validar o device flow. |

> Se nenhum cabecalho for enviado, as rotas protegidas retornam `401` com `{ "ok": false, "error": { "message": "Token interno invalido ou ausente." } }`.

---

## 2. Fluxo padrao e payloads

1. **Descobrir propertyId**  
   `GET /ga4/properties?name=<trecho>&account=<accounts/ID>` (sem token). Usar `account=accounts/<ID>` para restringir.

2. **Executar relatorios**  
   - `POST /ga4/properties/{propertyId}/runReport`  
   - `POST /ga4/properties/{propertyId}/runPivotReport`  
   - `POST /ga4/properties/{propertyId}/batchRunReports`  
   - `POST /ga4/properties/{propertyId}/batchRunPivotReports`  
   - `POST /ga4/properties/{propertyId}/runRealtimeReport`  
   - `POST /ga4/properties/{propertyId}/checkCompatibility`

3. **Formato de resposta**  
   - Sucesso: `{ "ok": true, "data": <payload GA4> }` (ou `"properties"` no lookup).  
   - Falha: `{ "ok": false, "error": { "message": "...", "details": { "status": HTTP_STATUS, ... } } }`.

4. **Exemplo real (dados mascarados)**  
   ```
   curl -H "x-internal-token: ga4-internal-token" \
     "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties?name=Nanda&account=accounts/195680050"
   ```
   ```
   {
     "ok": true,
     "properties": [
       { "propertyId": "270511251", "displayName": "Nanda Cora - Real", "parent": "accounts/195680050" },
       { "propertyId": "272657549", "displayName": "NandaAnalytics", "parent": "accounts/195680050" }
     ]
   }
   ```

   ```
   curl -X POST \
     -H "x-internal-token: taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9" \
     "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties/508138133/runReport" \
     -d '{
       "dimensions": [{ "name": "date" }, { "name": "sessionDefaultChannelGroup" }],
       "metrics": [{ "name": "sessions" }, { "name": "totalUsers" }, { "name": "purchaseRevenue" }],
       "dateRanges": [{ "startDate": "2024-10-01", "endDate": "2024-10-31" }],
       "limit": 5
     }'
   ```
   ```
   {
     "ok": true,
     "data": {
       "dimensionHeaders": [{ "name": "date" }, { "name": "sessionDefaultChannelGroup" }],
       "metricHeaders": [
         { "name": "sessions", "type": "TYPE_INTEGER" },
         { "name": "totalUsers", "type": "TYPE_INTEGER" },
         { "name": "purchaseRevenue", "type": "TYPE_CURRENCY" }
       ],
       "metadata": { "currencyCode": "USD", "timeZone": "America/Los_Angeles" }
     }
   }
   ```

5. **Ranges prontos (converter no cliente)**

| Range amigavel | startDate | endDate |
| --- | --- | --- |
| `LAST_7_DAYS` | `7daysAgo` | `yesterday` |
| `LAST_30_DAYS` | `30daysAgo` | `yesterday` |
| `THIS_MONTH` | primeiro dia do mes atual (`YYYY-MM-01`) | `today` |
| `LAST_MONTH` | primeiro dia do mes anterior | ultimo dia do mes anterior |

---

## 3. Clientes e properties com acesso GA4

- **Hannover**  accounts/175492763  
  `398907411 (Hannover GA4)`, `472674551 (Hannover Tomahawk)`
- **Nanda Cora**  accounts/195680050  
  `270511251 (Nanda Cora Real)`, `272657549 (NandaAnalytics)`
- **Santalberti**  accounts/201201451  
  `278056631 (Santalberti)`
- **Kisma Negocios**  accounts/203299751  
  `280743585 (Gerenciamento)`, `317369610 (Kisma Agencia)`, `320093381 (Kisma Marrie Loja Integrada)`
- **Aviarte**  accounts/209051900  
  `291776738 (Aviarte GA4)`
- **Lele da Cuca**  accounts/230500414  
  `317508848 (Lele da Cuca Site Novo)`
- **Flavio Cora**  accounts/269849457  
  `378644178 (F1 Marketing)`
- **Comprazzo Loja Online**  accounts/273196606  
  `383241927 (Comprazzo Yampi)`
- **Rio Brazilian Wax**  accounts/28021867  
  *(sem property ativo)*
- **Candela Fragrances Brasil**  accounts/283716904  
  `404970102 (Candela BR)`
- **Karyne Magalhaes**  accounts/284387276  
  `416710996 (Karyne Magalhaes)`
- **Narah Gestao**  accounts/296775732  
  `420360123 (Gestao Narah)`
- **Lele da Cuca  Narah**  accounts/330359400  
  `460073592 (Lele da Cuca)`
- **UniGoyazes**  accounts/335379126  
  `465874305 (UniGoyazes)`
- **Baby Raia / Kelly**  accounts/345868791  
  `478277421 (Baby Raia)`
- **EXC Foods**  accounts/346385721  
  `478855395 (EXC Foods)`
- **Oxen Currais**  accounts/347352169  
  `479938834 (Oxen Currais)`
- **Smart Cartorio Digital**  accounts/350756354  
  `483970467 (Smart Cart Digital)`
- **NH Painting**  accounts/360741773  
  `495922665 (New Hope Painting)`
- **Dr Luigi**  accounts/363302692  
  `498940122 (Dr Luigi Site)`
- **LR Abril Atacadista**  accounts/364714383  
  `500639479 (Rei dos Pulverizadores)`
- **Goias Cortinas**  accounts/368634085  
  `505311117 (Goias Cortinas)`
- **Demo Account**  accounts/54516992  
  `153293282 (Flood-It)`, `213025502 (Google Merch Shop)`, `508138133 (LG Property)`
- **Escobar Advogados**  accounts/74595541  
  *(sem property ativo)*
- **Avlon**  accounts/91045397  
  `336422131 (Avlon Ecomm GA4)`

---

## 4. Deploy e operacao

### Passo a passo
1. `gcloud config set project gmail-credentials-474123`
2. `gcloud builds submit --pack image=gcr.io/gmail-credentials-474123/agente-ga4-api`
3. `gcloud run deploy agente-ga4-api \`  
   `  --image gcr.io/gmail-credentials-474123/agente-ga4-api \`  
   `  --region us-central1 \`  
   `  --allow-unauthenticated \`  
   `  --set-env-vars "GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,GA4_OAUTH_SCOPES=https://www.googleapis.com/auth/analytics.readonly,INTERNAL_API_TOKEN=ga4-internal-token,INTERNAL_API_TOKENS=ga4-internal-token,taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9,GOOGLE_REFRESH_TOKEN=<opcional>"`  
   (quando possivel, substituir os tokens por referencias `--set-secrets` e manter os valores reais no Secret Manager).

4. Apos o deploy, confirmar nos logs `gcloud run services logs read agente-ga4-api --region us-central1 --limit 20` que o servico iniciou e, se necessario, disparar o device flow com `curl -H "x-internal-token: <token>` `/ga4/properties?name=teste`.

### Verificacoes rapidas (`curl`)
1. Lookup (sem token)  
   ```
   curl "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties?name=Nanda&account=accounts/195680050"
   ```
2. runReport (token legado)  
   ```
   curl -X POST -H "x-internal-token: ga4-internal-token" \
     -H "Content-Type: application/json" \
     "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties/270511251/runReport" \
     -d '{"dimensions":[{"name":"date"}],"metrics":[{"name":"sessions"},{"name":"totalUsers"}],"dateRanges":[{"startDate":"2025-10-01","endDate":"2025-10-24"}],"limit":10}'
   ```
3. runRealtimeReport (token Taskora)  
   ```
   curl -X POST -H "x-internal-token: taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9" \
     -H "Content-Type: application/json" \
     "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties/270511251/runRealtimeReport" \
     -d '{"dimensions":[{"name":"country"}],"metrics":[{"name":"activeUsers"}],"limit":5}'
   ```
4. checkCompatibility  
   ```
   curl -X POST -H "x-internal-token: taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9" \
     -H "Content-Type: application/json" \
     "https://agente-ga4-api-860407662159.us-central1.run.app/ga4/properties/270511251/checkCompatibility" \
     -d '{"dimensions":[{"name":"date"}],"metrics":[{"name":"sessions"},{"name":"totalUsers"}]}'
   ```

## 5. Testes mais recentes

| Data/hora (-03) | Comando | Resultado |
| --- | --- | --- |
| 2025-11-08 08:55 | Sequencia de chamadas HTTPS (lookup + run/pivot/batch/realtime/check) com `ga4-internal-token` | Todas as rotas responderam `ok: true`. |
| 2025-11-08 09:02 | Repeticao da mesma sequencia com `taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9` | Mesmos resultados, validando consumo paralelo. |
| 2025-11-08 09:11 | Nova execucao completa (lookup, runReport, runPivotReport, batchRunReports, batchRunPivotReports, runRealtimeReport, checkCompatibility) alternando os dois tokens | Sucesso; respostas incluem dimensionHeaders/metricHeaders e metadata de timezone/moeda. |

As chamadas retornaram `ok: true` para cada rota e incluíram `dimensionHeaders`/`metricHeaders`; qualquer erro vem acompanhado do HTTP status e do payload utilizado.

---

## 6. Seguranca, limites e boas praticas

- Payload maximo aceito pelo backend: `1 MB` (`express.json({ limit: '1mb' })`).
- GA4 Data API quotas (por property):
  - 40.000 core tokens/hora e 200.000/dia.
  - 14.000 core tokens/hora/projeto.
  - 10 requisicoes concorrentes (core e realtime).
  - 120 requisicoes/hora envolvendo dimensoes potencialmente thresholded (`userAgeBracket`, `userGender`, `audienceId`, etc.).
- Nenhum dado de relatorio e persistido; o servico atua apenas como proxy autenticado.
- Qualquer vazamento do token interno concede acesso a todas as properties listadas acima  rotacionar periodicamente e priorizar o uso do Secret Manager.
- Sempre validar combinacoes complexas via `checkCompatibility` antes de enviar payloads grandes, evitando consumo desnecessario de quota.

---

## 7. Checklist operacional

| Item | Status | Observacoes |
| --- | --- | --- |
| Host/rota confirmados |  | `https://agente-ga4-api-860407662159.us-central1.run.app/ga4/...` |
| Tokens publicados e aceitos |  | `ga4-internal-token`, `taskora-ga4-token-ef0bc053520244be9321eba3ec83a9a9` |
| Autenticacao GA4 (OAuth + quotas) |  | Refresh token valido (`analytics.readonly`) e fluxo device pronto. |
| Mapeamento clients  properties |  | Listado na secao 3 deste documento. |
| Exemplos e limites |  | Secoes 2 e 6. |
| Deploy mais recente documentado |  | 2025-11-08 08:59 (-03). |
| Teste pos-deploy documentado |  | Sequencia de chamadas HTTPS (2025-11-08 09:11 -03). |

---

## 8. Proximos passos sugeridos

1. **Secret Manager para tokens**  criar `projects/gmail-credentials-474123/secrets/mcp-ga4-taskora` e mover o valor do token para la, referenciando via `--set-secrets`.
2. **Endpoint resumido opcional**  caso seja necessario um wrapper com ranges pre-definidos (`/tools/ga4_summary/call`), implementar um controller fino que traduza os ranges amigaveis e devolva apenas `metrics` + `updatedAt`.
3. **Monitoramento**  adicionar alerta simples de quota via Cloud Monitoring para `analyticsdata.googleapis.com` (tokens por hora) e para erros 401/403 no Cloud Run.
