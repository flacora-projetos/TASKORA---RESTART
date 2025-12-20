# Automação do Seed de Clientes do Diretório

## Opção A – Cloud Scheduler chamando a API
1. **Criar um token de serviço (ID token)**
   ```bash
   gcloud iam service-accounts create taskora-scheduler --project=dacora---tarefas
   gcloud run services add-iam-policy-binding taskora-api \
     --project=dacora---tarefas \
     --region=southamerica-east1 \
     --member=serviceAccount:taskora-scheduler@dacora---tarefas.iam.gserviceaccount.com \
     --role=roles/run.invoker
   ```
2. **Criar o job**
   ```bash
   CLOUD_RUN_URL="https://taskora-api-southamerica-east1.run.app"
   gcloud scheduler jobs create http directory-seed \
     --project=dacora---tarefas \
     --location=southamerica-east1 \
     --schedule="0 6 * * *" \
     --uri="${CLOUD_RUN_URL}/maintenance/integrations/directory/sync" \
     --http-method=POST \
     --oidc-service-account-email=taskora-scheduler@dacora---tarefas.iam.gserviceaccount.com \
     --oidc-token-audience="${CLOUD_RUN_URL}" \
     --message-body='{"batchSize":50,"maxEntries":1000}'
   ```
3. **Permissões**
   - A service account `taskora-scheduler` precisa de `roles/run.invoker`.
   - Como a API exige autenticação, use um token de desenvolvimento (header `Authorization`) ou crie um tenant específico com `orgId` dedicado ao seed e configure o header no Scheduler (`--headers "Authorization=Bearer <token>"`).

## Opção B – Cloud Run Jobs
1. **Criar job que usa o script interno**
   ```bash
   IMAGE=gcr.io/dacora---tarefas/taskora-api:latest
   gcloud run jobs create directory-seed-job \
     --project=dacora---tarefas \
     --region=southamerica-east1 \
     --image=$IMAGE \
     --command=pnpm \
     --args="--filter,@taskora/api,seed:directory" \
     --service-account=taskora-backend@dacora---tarefas.iam.gserviceaccount.com \
     --set-secrets="FIREBASE_CREDENTIALS_JSON=taskora-firebase-admin:latest,EXTERNAL_API_BEARER=taskora-backend-bearer:latest,EXTERNAL_MCP_TOKEN=taskora-mcp-token:latest,EXTERNAL_GA4_TOKEN=taskora-ga4-token:latest" \
     --set-env-vars="SEED_ORG_ID=org-prod,SEED_ACTOR_ID=seed-job"
   ```
2. **Agendar execução**
   ```bash
   gcloud scheduler jobs create cron directory-seed-job \
     --project=dacora---tarefas \
     --location=southamerica-east1 \
     --schedule="0 6 * * *" \
     --uri="https://southamerica-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/dacora---tarefas/jobs/directory-seed-job:run" \
     --http-method=POST \
     --oauth-service-account-email=taskora-backend@dacora---tarefas.iam.gserviceaccount.com
   ```
3. **Vantagens**
   - Não precisa expor endpoint público.
   - Usa o mesmo código do repositório e os segredos do Secret Manager.

## Logs e monitoramento
- Acompanhe execuções com:
  ```bash
  gcloud run jobs executions list --job=directory-seed-job --region=southamerica-east1
  gcloud run jobs executions describe EXECUTION_ID --region=southamerica-east1
  ```
- Em caso de falha, rode manualmente `pnpm --filter @taskora/api seed:directory` para investigar localmente usando os mesmos segredos.
## Sincronizacao do cache de metricas
1. **Job Cloud Run (imagem da API)**
   ```bash
   IMAGE=gcr.io/dacora---tarefas/taskora-api:latest
   gcloud run jobs create metrics-sync \
     --project=dacora---tarefas \
     --region=southamerica-east1 \
     --image=$IMAGE \
     --command=node \
     --args="/workspace/apps/api/dist/scripts/run-metrics-sync.js" \
     --service-account=taskora-backend@dacora---tarefas.iam.gserviceaccount.com \
     --set-secrets="FIREBASE_CREDENTIALS_JSON=taskora-firebase-admin:latest,EXTERNAL_API_BEARER=taskora-backend-bearer:latest,EXTERNAL_MCP_TOKEN=taskora-mcp-token:latest,EXTERNAL_GA4_TOKEN=taskora-ga4-token:latest"
   ```
2. **Agendar execucao (05:30 UTC)**
   ```bash
   gcloud scheduler jobs create http metrics-sync \
     --project=dacora---tarefas \
     --location=southamerica-east1 \
     --schedule="30 5 * * *" \
     --uri="https://southamerica-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/dacora---tarefas/jobs/metrics-sync:run" \
     --http-method=POST \
     --oauth-service-account-email=taskora-backend@dacora---tarefas.iam.gserviceaccount.com
   ```
3. **Execucao manual**
   ```bash
   gcloud run jobs execute metrics-sync --region=southamerica-east1 --wait
   ```

## Sincronizacao das propriedades GA4
1. **Job Cloud Run (usa o runner interno)**
   ```bash
   IMAGE=gcr.io/dacora---tarefas/taskora-api:latest
   gcloud run jobs create ga4-properties-sync \
     --project=dacora---tarefas \
     --region=southamerica-east1 \
     --image=$IMAGE \
     --command=node \
     --args="/workspace/apps/api/dist/scripts/run-ga4-properties-sync.js" \
     --service-account=taskora-backend@dacora---tarefas.iam.gserviceaccount.com \
     --set-secrets="FIREBASE_CREDENTIALS_JSON=taskora-firebase-admin:latest,EXTERNAL_GA4_TOKEN=mcp-ga4-taskora:latest" \
     --set-env-vars="GA4_PROPERTIES_DRY_RUN=false"
   ```
   - O runner aceita `GA4_PROPERTIES_DRY_RUN=true` para execucoes de teste (nao grava no Firestore). O default falso ja sobe sincronizando de fato.
2. **Agendar execucao (por exemplo, diariamente as 06:00 UTC)**
   ```bash
   gcloud scheduler jobs create http ga4-properties-sync \
     --project=dacora---tarefas \
     --location=southamerica-east1 \
     --schedule="0 6 * * *" \
     --uri="https://southamerica-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/dacora---tarefas/jobs/ga4-properties-sync:run" \
     --http-method=POST \
     --oauth-service-account-email=taskora-backend@dacora---tarefas.iam.gserviceaccount.com
   ```
3. **Execucao manual**
   ```bash
   gcloud run jobs execute ga4-properties-sync --region=southamerica-east1 --wait
   ```
