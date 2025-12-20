# Deploy da API no Cloud Run (dacora---tarefas)

## Pré-requisitos
- `gcloud` instalado e autenticado como `flacora@gmail.com` (ou outra conta com *Owner* no projeto `dacora---tarefas`).
- Imagem da API publicada em `gcr.io/dacora---tarefas/taskora-api:<tag>` (pode ser gerada via Cloud Build).
- Secrets existentes no Secret Manager do mesmo projeto:
  - `taskora-firebase-admin` → JSON da service account `taskora-backend@dacora---tarefas.iam.gserviceaccount.com`.
  - `taskora-backend-bearer` → token para `EXTERNAL_API_BEARER`.
  - `taskora-mcp-token` → token para `EXTERNAL_MCP_TOKEN`.
  - `taskora-ga4-token` → token `taskora-ga4-token-...` para o Cloud Run do GA4.

> A service account `taskora-backend@dacora---tarefas.iam.gserviceaccount.com` já possui `roles/datastore.owner`, `roles/editor` e `roles/secretmanager.secretAccessor`. Certifique-se de usá‑la como identidade do serviço.

## Comando recomendado
```bash
PROJECT_ID=dacora---tarefas
REGION=southamerica-east1
SERVICE=taskora-api
IMAGE=gcr.io/$PROJECT_ID/taskora-api:latest

gcloud run deploy $SERVICE \
  --project=$PROJECT_ID \
  --region=$REGION \
  --image=$IMAGE \
  --service-account=taskora-backend@$PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars="PORT=8080,GA4_CHECK_PROPERTY_ID=270511251,GA4_CHECK_START_DATE=2025-10-01,GA4_CHECK_END_DATE=2025-10-02,PINTEREST_APP_ID=1536379,PINTEREST_APP_SECRET=e8d1854a7fefb9c4a018141e8d52f74b0ad1e6cb,PINTEREST_SCOPES=pins:read,boards:read,user_accounts:read,ads:read,catalogs:read" \
  --set-env-vars="PINTEREST_ALLOWED_REDIRECTS=https://taskora-dashboard.web.app/integrations/pinterest/callback,http://localhost:3000/integrations/pinterest/callback" \
  --set-secrets="FIREBASE_CREDENTIALS_JSON=taskora-firebase-admin:latest,EXTERNAL_API_BEARER=taskora-backend-bearer:latest,EXTERNAL_MCP_TOKEN=taskora-mcp-token:latest,EXTERNAL_GA4_TOKEN=taskora-ga4-token:latest"
```

### Observações
- `FIREBASE_CREDENTIALS_JSON` injeta o JSON completo da chave; o código já lê esse valor (ou `FIREBASE_CREDENTIALS_PATH`, em dev).
- Os parâmetros `PINTEREST_*` usam os dados oficiais descritos em `Documentacao/pinterest_API.md`; mantenha os mesmos valores em todos os ambientes para liberar o OAuth do MCP.
- Caso precise apontar para outra versão da imagem, ajuste `IMAGE` antes do deploy.
- Para ambientes privados, remova `--allow-unauthenticated` e configure o IAM do serviço conforme necessário.
- Se quiser definir variáveis adicionais (ex.: `AUTH_ALLOW_INSECURE=false`), adicione-as em `--set-env-vars`.

## Pós-deploy
1. Rode `pnpm integrations:check` apontando para a URL do Cloud Run (com tokens reais) para garantir que API externa, MCP e GA4 seguem respondendo.
2. Execute `pnpm --filter @taskora/api seed:directory` (local ou via job) para repovoar a base Firestore do ambiente recém implantado.
3. Monitore os logs (`gcloud run services logs tail taskora-api --project=$PROJECT_ID --region=$REGION`) buscando qualquer erro de autenticação ou secret ausente.

