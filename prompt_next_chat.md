# Contexto rápido para Chat Novo

## Documentação obrigatória
- Documentacao/chat_novo.md (ler as entradas de 11/11 para entender login/login Google, deploys e pendências)
- Documentacao/README_dev.md
- Documentacao/Documentacao_Novos_Agentes.md
- Documentacao/deploy_cloudrun_taskora.md
- Documentacao/seed_scheduler.md

## Estado atual
- Frontend (Next.js) publicado no Firebase Hosting com login Google. API base esperada: https://api-wviue4ksza-uc.a.run.app/api.
- Backend Fastify rodando no Cloud Run (serviço 	askora-api, região southamerica-east1) com imagem gcr.io/dacora---tarefas/taskora-api:latest.
- CORS: uthenticate ignora OPTIONS; Cloud Run precisa estar com acesso público habilitado.
- Usuários iniciais já seedados via pnpm --filter @taskora/api seed:users.

## Pendências
1. No Cloud Run ? 	askora-api ? aba Segurança, marcar **Permitir acesso público** (isso adiciona o binding llUsers -> Cloud Run Invoker).
2. Testar login em https://taskora-dashboard.web.app em aba anônima; conferir se /api/auth/me responde 200 (sem erros CORS). Se ainda falhar, capturar o erro no console.
3. Se precisar redeployar a API: usar Dockerfile.api, executar gcloud builds submit --tag=gcr.io/dacora---tarefas/taskora-api:latest --file=Dockerfile.api ., depois gcloud run deploy … conforme a documentação.

## Observações
- .env.development.local ficou reservado para dev local; .env (prod) é usado nos builds.
- Registrar novas ações em Documentacao/chat_novo.md.
