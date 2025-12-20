# MCP Pinterest – Plano de Implementação

## Objetivo
Disponibilizar um conector MCP específico para contas Pinterest Ads, nos mesmos moldes dos conectores de Google/Meta: o agente externo chamará esse MCP, autenticando com um token dedicado, e receberá métricas normalizadas (spend, impressões, cliques, conversões, etc.) de cada cliente que possua integração Pinterest ativa.

## Recursos existentes
- **App ID:** 1536379
- **App Secret:** e8d1854a7fefb9c4a018141e8d52f74b0ad1e6cb
- **Redirect URIs registradas:**  
  - `https://taskora-dashboard.web.app/integrations/pinterest/callback`  
  - `http://localhost:3000/integrations/pinterest/callback`
- **Escopos iniciais:** `pins:read, boards:read, user_accounts:read, ads:read, catalogs:read`
- **Token de teste:** `pina_AMAXW4IX...` (usado apenas para validar o fluxo)

## Fases do trabalho
1. **Fluxo de autorização no Taskora**
   - Botão “Conectar Pinterest” na ficha do cliente (card Integrations).
   - Rota `/integrations/pinterest/callback` no backend para trocar `code` ↔ `access_token`/`refresh_token`.
   - Armazenar tokens em `client.integrations.pinterest` (incluindo `expires_at`).

2. **Serviço MCP Pinterest**
   - Cloud Run/Functions dedicado (ex.: `https://pinterest-mcp-<hash>.run.app/tools/...`).
   - Header `x-internal-token: taskora-pinterest-token-<hash>` para autenticação (token a ser criado e informado ao agente).
   - Ferramentas MCP previstas:
     - `pinterest_summary`: recebe `clientId` ou `accountId`, retorna spend/impressões/cliques/conversões do período solicitado.
     - `pinterest_ads`: detalha desempenho por campanha/conjunto de anúncios.
     - (Opcional) `pinterest_boards/pins` conforme roadmap futuro.
   - O MCP lê os tokens gravados no Taskora (Firestore) e se comunica com a API Pinterest (gráfico Ads v5).

3. **Entrega ao agente externo**
   - Documentar endpoints (`/tools/pinterest_summary/call` etc.) no mesmo formato do MCP atual.
   - Fornecer o token `taskora-pinterest-token-…` para o parceiro e registrar no `DOCUMENTAÇÃO/chat_novo_saldos_mcp.md`.

## Próximos passos imediatos
1. Implementar o fluxo OAuth (botão + callback) para capturar tokens Pinterest por cliente.
2. Criar o serviço MCP (estrutura básica + autenticação).
3. Expor `pinterest_summary` com métricas diárias (períodos: `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, etc.).
4. Fornecer o token ao agente e atualizar a documentação operacional.

## 2025-11-19 - Base do serviço MCP
- Criado o pacote `apps/pinterest-mcp` (Fastify + TypeScript) com endpoint `/health` e o dispatcher padrão `POST /tools/:tool/call`.
- Autenticação via header `x-internal-token` ou `Authorization: Bearer`, validando contra `MCP_INTERNAL_TOKEN`.
- A ferramenta `pinterest_summary` já aceita `clientId`, `accountId` e `range`, consulta o Firestore para verificar se o cliente possui token salvo e responde em modo `pending` até que a chamada real à API do Pinterest seja implementada.
- Adicionado `.env.example` e instruções em `README_dev.md` para rodar o serviço localmente (`pnpm --filter @taskora/pinterest-mcp dev|test|lint`).
