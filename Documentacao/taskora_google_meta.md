# Liberação do Taskora para Google/Meta (Projeto `trae-appsaldos-473218-n7`)

## 1. Tokens definitivos

| Finalidade | Valor | Secret Manager |
| --- | --- | --- |
| Backend (Bearer) | `V6R5tRJ1knPY/KZjEuZnJpSMyDGRIdHHVTDcPjySJH6M/6LY` | `taskora-backend-bearer` |
| MCP (Cliente) | `cwLWru7Keb+GHec3fMV5SebXObi9b4+O` | `taskora-mcp-token` |

- Ambos os segredos foram criados no projeto `trae-appsaldos-473218-n7` com replicação automática.
- A service account `serviceAccount:taskora-backend@dacora---tarefas.iam.gserviceaccount.com` recebeu `roles/secretmanager.secretAccessor` em cada segredo.

## 2. Backend (`api-wviue4ksza-uc.a.run.app`)

### Mudanças
1. Middleware `bearerAuthMiddleware` ajustado (server + Cloud Functions) para aceitar múltiplos tokens (comma separated).
2. `INTERNAL_API_TOKEN` (Secret Manager): nova versão contém `saldos-internal-token-2025,V6R5tRJ1knPY/KZjEuZnJpSMyDGRIdHHVTDcPjySJH6M/6LY`.
3. Cloud Functions/Run `api` redeployada via `gcloud beta functions deploy api --gen2 …` usando `source=saldos-meta-e-google/functions`.

### Resultado
- O backend passa a aceitar o Bearer antigo e o novo token Taskora em `Authorization: Bearer ...`.
- Endpoint principal continua `https://api-wviue4ksza-uc.a.run.app/api`.

## 3. MCP (`saldos-mcp-817801200453`)

### Mudanças
1. Env `MCP_TOKEN` atualizada para incluir os dois tokens (`axR9kH…` legado e `cwLWru7K…` do Taskora).
2. `BACKEND_BEARER` alocado para o novo token do backend, mantendo alinhado com o Cloud Run/Functions.
3. Serviço Cloud Run `saldos-mcp` atualizado com `gcloud run services update saldos-mcp --env-vars-file=…` (ALLOWED_ORIGIN, BACKEND_BASE_URL, etc.) gerando a revisão `saldos-mcp-00053-p26`.

### Resultado
- Taskora pode acessar o MCP em `https://saldos-mcp-817801200453.us-central1.run.app/tools/<tool>/call` usando o novo token.
- O MCP continua injetando o Bearer interno atualizado ao falar com o backend.

## 4. Documentação & referência

- `DOCUMENTAÇÃO/GEMINI AGENT/apis_e_mcp.md` recebeu seção 4 com o passo a passo operacional e os tokens definitivos.
- Este arquivo (`taskora_google_meta.md`) consolida o que foi executado: criação de segredos, permissões, deploys e URLs.

## 5. Pendências

- Meta Ads/allowlist do Taskora não foi alterada (aguarda App ID/domínio caso necessário).
- Se o Taskora precisar de token Meta próprio, gerar e armazenar no projeto Taskora, conforme instruções originais.
