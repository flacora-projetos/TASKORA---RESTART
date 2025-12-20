# Terraform - Taskora

## Estrutura
```
infra/
  terraform/
    main.tf
    providers.tf
    variables.tf
    outputs.tf
    environments/
      dev.tfvars
      prod.tfvars
```

## Pré-requisitos
- Terraform >= 1.6
- Conta com acesso ao projeto GCP (`dacora---tarefas`)
- `GOOGLE_APPLICATION_CREDENTIALS` apontando para chave de serviço com permissões de Editor / Owner

## Inicialização
```bash
cd infra/terraform
terraform init -backend-config="bucket=<bucket-do-state>"
terraform plan -var-file="environments/dev.tfvars"
terraform apply -var-file="environments/dev.tfvars"
```

## Recursos Provisionados (MVP)
- Projeto existente (`dacora---tarefas`)
- Habilitação de APIs: Cloud Run, Firestore, Cloud Build, Secret Manager, IAM, Service Usage
- Firestore (modo Native) com configuração regional
- Bucket Cloud Storage (`taskora-app-artifacts`) para anexos e assets do frontend
- Service account `taskora-runner` com papéis mínimos (Cloud Run Invoker, Service Account Token Creator)
- Tópico Pub/Sub para notificações futuras (`taskora-events`)

> Próximas iterações incluirão Cloud Scheduler, Cloud Tasks e integração com Cloud Monitoring.
