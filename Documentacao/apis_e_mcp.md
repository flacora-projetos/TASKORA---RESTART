# APIs & MCP – Referência Rápida

Este guia resume onde estão os dados brutos (APIs) e como o Modelo Context Protocol (MCP) já expõe essas informações para os agentes. Use-o para entender rapidamente **onde chamar**, **qual payload enviar** e **como autenticar**.

---

## 1. APIs de Dados Brutos

| Item | Detalhes |
| --- | --- |
| **Hospedagem principal** | **Cloud Run** – `https://api-wviue4ksza-uc.a.run.app/api` (região `us-central1`). |
| **Fallback/Legacy** | **Cloud Functions v2** – `https://us-central1-trae-appsaldos-473218-n7.cloudfunctions.net/api`. Mesmo contrato de rotas. |
| **Autenticação** | Header `Authorization: Bearer REDACTED_BACKEND_BEARER` (token atual do backend). |
| **Headers obrigatórios** | `Accept: application/json` + identificar cliente (User-Agent / X-Client). |
| **Controle de acesso** | Rate limit 120 req/min por IP+token e rejeição 401 para Bearer inválido. |

### 1.1. Saúde & Descoberta

| Endpoint | Método | Query/Payload | Descrição / Observações | Hosting |
| --- | --- | --- | --- | --- |
| `/health` | GET | – | Ping do backend (retorna `{ status, timestamp }`). | Cloud Run / Cloud Functions |
| `/google/accounts` | GET | `activeOnly=true|false` | Lista contas Google Ads visíveis. | Cloud Run |
| `/google/accounts/explore` | GET | `activeOnly` | Mesmo que acima, porém já inclui `warning`/`failures`. | Cloud Run |
| `/meta/accounts` | GET | – | Lista contas Meta Ads (usado como base para pré-pagas). | Cloud Run |

### 1.2. Google Ads

| Endpoint | Método | Query | Payload Corpo | Notas |
| --- | --- | --- | --- | --- |
| `/google/accounts/:customerId/summary` | GET | `range`, `loginCustomerId` | – | Retorna `{ ok, data }` com spend, impressões, CTR, CPC. Range aceita presets GAQL (`TODAY`, `LAST_7_DAYS`, `CUSTOM:AAAA-MM-DD:BBBB-MM-DD`). |
| `/google/accounts/:customerId/campaigns` | GET | `range`, `loginCustomerId`, `limit`, `orderBy`, `status`, `channelType` | – | Equivale ao que o MCP expõe como `google_campaigns`. Ideal para breakdown por campanha. |
| `/google/accounts/:customerId/insights` | GET | `range`, `loginCustomerId`, `limit` | – | Retorna top spend/conversions/CTR; clamp automático `1–50`. |
| `/google/accounts/:customerId/structure` | GET | `level`, `limit`, `campaignIds/campaign_ids`, `adGroupIds/ad_group_ids`, `loginCustomerId` | – | Estrutura (campanhas, ad groups, anúncios, keywords, assets). |

### 1.3. Meta Ads

| Endpoint | Método | Query | Payload | Notas |
| --- | --- | --- | --- | --- |
| `/meta/accounts/:accountId/summary` | GET | `range` | – | Totais da conta Meta com `actions` e `action_values`. Range convertido para presets (`last_7d`, etc.). |
| `/meta/accounts/:accountId/campaigns` | GET | `range`, `level` (`campaign|adset|ad`), `limit` | – | Usado para rankings; clamp de `limit` igual ao MCP. |
| `/meta/accounts/:accountId/insights` | GET | `range`, `limit` | – | Top spend/conversions/CTR. |
| `/meta/accounts/:accountId/structure` | GET | `range`, `level`, `limit`, `ids` | – | Estrutura detalhada (status, targeting, creatives). |
| `/meta/accounts` | GET | – | Também serve de base para `meta_prepaid_balances` filtrando `isPrePaid === true`. |

### 1.4. Diretório de Clientes

| Endpoint | Método | Query/Payload | Notas |
| --- | --- | --- | --- |
| `/directory/clients` | GET | `q`, `platform=google|meta`, `limit (1-100)`, `offset` | Usa `searchDirectoryClients`. Se não encontrar e houver `q`, dispara `discoverAndSyncClients` e refaz a busca. |
| `/directory/clients/:id` | GET | – | Detalhes de um cliente (IDs Google/Meta, apelidos, notas). |
| `/directory/clients` | POST | Body JSON com os campos do cliente | Cria/atualiza (`upsertDirectoryClient`). |
| `/directory/clients/:id` | PATCH | Body parcial | Atualiza com validação. |

> **Dica:** A mesma API serve dois ambientes. Em produção priorize Cloud Run (`api-wviue4ksza-uc.a.run.app`). A Function `trae-appsaldos…` é fallback quando o serviço containerizado não estiver disponível.

---

## 2. Servidores MCP

### 2.1. MCP “Saldos & Métricas” (produção)

- **Host (Cloud Run):** `https://saldos-mcp-817801200453.us-central1.run.app`  
- **Autenticação:** `Authorization: Bearer REDACTED_BACKEND_BEARER` (mesmo token reutilizado pelos agentes atuais).  
- **Backend alvo:** `https://api-wviue4ksza-uc.a.run.app/api` (injeta `Authorization: Bearer <BACKEND_BEARER>` do mesmo arquivo).  
- **Ferramentas expostas (todas listadas em `DOCUMENTAÇÃO/tools_disponiveis.md`):**
  - `health_check` – ping do backend.
  - `client_lookup` – proxy de `/directory/clients`.
  - `google_summary`, `google_insights`, `google_structure`.
  - `meta_summary`, `meta_insights`, `meta_structure`.
  - `meta_prepaid_balances`.
  - `organization_summary` (agrega Google + Meta por organização).
- **Formato de chamada:** padrão MCP/HTTP – `POST https://…/tools/<tool>/call` com JSON `{ "args": { ... } }`.
- **Respostas:** `{ status, ok, body }`, replicando erros HTTP do backend quando necessário.

### 2.2. MCP “Agent Builder Helper” (especificação)

- **Host alvo (deploy dedicado):** deverá ser publicado conforme `DOCUMENTAÇÃO/MCP/SPEC_MCP_Saldos_Deploy.md` – exemplo esperado `https://mcp-saldos-xxxxx-uc.a.run.app/mcp`.
- **Backends suportados:**  
  1. `https://us-central1-trae-appsaldos-473218-n7.cloudfunctions.net/api` (obrigatório).  
  2. Host alternativo (Cloud Run) apenas se o primeiro falhar.
- **Autenticação:**  
  - Cliente → MCP: `Authorization: Bearer <MCP_AUTH_TOKEN>` (token gerado no deploy).  
  - MCP → Backend: `Authorization: Bearer REDACTED_BACKEND_BEARER` (enviar apenas se configurado nas envs).  
- **Ferramentas mínimas:** `health`, `google_summary`, `meta_summary` (todas GET no backend, com normalização de `range` e datas CUSTOM).  
- **Requisitos adicionais:** headers `Accept: application/json` e `X-Client: agent-builder-saldos-helper`, timeout 10s, logging `{tool, url, status, latency_ms}`, e respostas de erro padronizadas `{ status, error, body }`.

### 2.3. Tokens e Segredos

- **MCP Token atual (produção):** `REDACTED_BACKEND_BEARER` (mesmo valor usado como BACKEND_BEARER/token único neste ambiente).  
- **Variáveis úteis:**  
  - `MCP_TOKEN` – usado por agentes internos para autenticar no Cloud Run atual.  
  - `BACKEND_BASE_URL` / `BACKEND_BEARER` – informam o host Cloud Run e o Bearer enfileirado no MCP.  
  - `MCP_AUTH_TOKEN` – deverá ser definido ao publicar o novo MCP descrito no SPEC (imprimir no deploy).

> **Boas práticas:** gere tokens distintos por agente/ambiente, armazene-os no Secret Manager e sempre logue o `call_id` com `Authorization` mascarado. O MCP já aplica rate-limit (60 req/min por token) e TTL curto (30s) para summaries/insights.

---

## 3. Como reutilizar

1. **Consumir dados brutos diretamente**: aponte qualquer serviço server-to-server para `https://api-wviue4ksza-uc.a.run.app/api`, com o Bearer interno. Útil para ETLs ou painéis customizados.
2. **Usar o MCP existente**: agentes (Gemini, GPT, etc.) chamam `https://saldos-mcp-817801200453.us-central1.run.app/tools/<tool>/call` com o `MCP_TOKEN`. Ideal para evitar expor segredos do backend.
3. **Deploy MCP dedicado (Agent Builder)**: siga `SPEC_MCP_Saldos_Deploy.md` para ter um servidor isolado por agente, com token próprio (`MCP_AUTH_TOKEN`) e fallback automático para Cloud Functions.

Com este arquivo você tem a lista do que já existe, onde está rodando e como autenticar em cada camada.

api vertex
Chave de API criada
Transfira esta chave com o parâmetro key=API_KEY para usá-la no seu aplicativo.
REDACTED_VERTEX_API_KEY