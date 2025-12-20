# Tutorial – Conceder Acesso ao Backend de APIs e MCP

Este passo a passo ajuda a liberar o projeto **Taskora** para consumir as APIs e os MCPs que já existem no projeto **CONTROLE SALDOS META E GOOGLE** (`trae-appsaldos-473218-n7`). A ideia é **reaproveitar tudo** com o mínimo possível de interferência no projeto original.

---

## 1. Visão Geral
- **Backend das APIs**: `https://api-wviue4ksza-uc.a.run.app/api` (Cloud Run, projeto `trae-appsaldos-473218-n7`).
- **Fallback**: `https://us-central1-trae-appsaldos-473218-n7.cloudfunctions.net/api`.
- **MCP existente**: `https://saldos-mcp-817801200453.us-central1.run.app`.
- **Token atual**: `Authorization: Bearer REDACTED_BACKEND_BEARER`.

> Objetivo: criar **credenciais dedicadas ao Taskora** sem alterar o que já funciona para os outros consumidores.

---

## 2. Backend GCP – Token dedicado

### 2.1. Criar (ou gerar) um token exclusivo
1. No projeto **`trae-appsaldos-473218-n7`**, abra o **Secret Manager**.
2. Clique em **“Criar segredo”** e defina um nome claro, por exemplo: `taskora-backend-bearer`.
3. Cole o novo token (pode ser uma string aleatória longa gerada via `openssl rand -base64 48` ou ferramenta similar).  
   > Enquanto o token dedicado não é criado no projeto original, já armazenamos o token atual no projeto **Taskora** (`taskora-backend-bearer`) para facilitar os testes.
4. Salve o segredo.

### 2.2. Liberar acesso ao Token
1. Ainda no Secret Manager, vá em **Ações → Permissões** do segredo recém-criado.
2. Adicione a service account do Taskora (ex.: `taskora-backend@taskora-dev.iam.gserviceaccount.com`) com o papel **Secret Manager Secret Accessor**.
3. Pronto: apenas o Taskora conseguirá ler esse token.

### 2.3. Registrar o novo token no Taskora
1. No projeto Taskora, crie uma variável/segredo `BACKEND_BEARER_TASKORA`.
2. Configure o backend do Taskora para enviar `Authorization: Bearer <novo_token>` ao chamar `api-wviue4ksza-uc.a.run.app`.
3. Opcional: defina um `X-Client: taskora` para facilitar auditoria (o backend original já aceita esse header extra).

> Caso exista firewall ou allowlist de IP: inclua o IP ou o Cloud Run do Taskora na lista de origem permitida. Se não houver restrição hoje, não é necessário mexer.

---

## 3. MCP – Token separado

### 3.1. Gerar token para o Taskora
1. No projeto original, repita o processo do Secret Manager e crie `taskora-mcp-token`.
2. Conteúdo: token aleatório (pode usar `openssl rand -base64 32`).

### 3.2. Habilitar uso do token
1. No Cloud Run do MCP (`saldos-mcp-817801200453`), adicione a variável de ambiente `MCP_TOKEN_TASKORA=<novo_token>`.
2. Atualize o código/env do MCP (caso precise) para aceitar múltiplos tokens – geralmente basta permitir uma lista em vez de um único valor.

### 3.3. Consumir o MCP
1. No Taskora, guarde `MCP_TOKEN_TASKORA` em segredo.
2. As chamadas passam a ser `Authorization: Bearer <MCP_TOKEN_TASKORA>`.
3. Mantém-se o mesmo formato: `POST https://saldos-mcp-817801200453.../tools/<tool>/call`.

> Se preferir isolar totalmente, publique um MCP dedicado conforme `SPEC_MCP_Saldos_Deploy.md` usando o novo token – o processo é o mesmo, mas o host ficaria no projeto Taskora.

---

## 4. Meta Ads – Autorizar o novo app

1. Abra o painel do app Meta Ads usado hoje.
2. Vá em **Configurações → Usuários/Clientes liberados**.
3. Inclua o **App ID** ou **domínio** usado pelo Taskora (por exemplo, `taskora.app` ou o ID do app configurado no Taskora).
4. Gere (ou compartilhe) um **token de acesso** para o Taskora:
   - Pode ser um **long-lived token** criado nas Ferramentas da Meta.
   - Armazene no Secret Manager do Taskora (ex.: `META_TASKORA_ACCESS_TOKEN`).
5. Registre no Taskora a URL base já existente (`/meta/accounts/...`). O Taskora usará o mesmo endpoint, apenas com o token específico.

> Caso o backend atual valide origens/domínios, inclua também o domínio do Taskora no allowlist do app Meta.

---

## 5. Checklist Final

| Item | Status |
| --- | --- |
| Token exclusivo no GCP (backend) criado e guardado | ☑ `taskora-backend-bearer` (proj. Taskora) |
| Service Account do Taskora com acesso ao segredo | ☑ `taskora-backend@dacora---tarefas.iam.gserviceaccount.com` |
| Taskora enviando `Authorization: Bearer <token_taskora>` nas chamadas | ☐ (pendente configurar na aplicação) |
| Token MCP dedicado criado/registrado | ☑ `taskora-mcp-token` (proj. Taskora) |
| Taskora usando o novo `MCP_TOKEN` | ☐ (pendente configurar na aplicação) |
| App Meta atualizado com domínio/App ID do Taskora | ☐ |
| Token Meta próprio armazenado no Secret Manager do Taskora | ☐ |

> Depois de marcar todos os itens, o Taskora ficará totalmente separado do projeto original, consumindo as APIs/MCPs com credenciais próprias, sem interferir nas integrações existentes.

---

## 6. Prompt para o Agente responsável pelas APIs/MCP

> **Contexto**: precisamos liberar o projeto Taskora para consumir o backend (`api-wviue4ksza-uc.a.run.app`) e o MCP (`saldos-mcp-817801200453`) do projeto original **CONTROLE SALDOS META E GOOGLE** (`trae-appsaldos-473218-n7`). Tokens temporários já estão no projeto Taskora, mas agora precisamos gerar credenciais definitivas no projeto original.  
> **Objetivo**: seguir as instruções abaixo exatamente, garantindo que nada além do necessário seja alterado.

### Passo a passo
1. **Criar tokens dedicados no projeto `trae-appsaldos-473218-n7`:**
   - Secret 1: `taskora-backend-bearer` com um token aleatório (~48 chars, Base64).
   - Secret 2: `taskora-mcp-token` com outro token aleatório (32-48 chars).
2. **Permissões dos segredos:**
   - Em cada segredo, adicionar `serviceAccount:taskora-backend@dacora---tarefas.iam.gserviceaccount.com` com o papel `roles/secretmanager.secretAccessor`.
3. **Backend (Cloud Run / Functions):**
   - Garantir que o serviço aceite chamadas com `Authorization: Bearer <novo_token>`.
   - (Se houver ACL/IP allowlist) liberar o serviço do Taskora que fará essas chamadas.
4. **MCP:**
   - Atualizar a configuração para aceitar o `taskora-mcp-token` (pode ser via env var/secret).
   - Se necessário, incluir `taskora-backend@dacora---tarefas.iam.gserviceaccount.com` como SA autorizada a invocar o MCP.
5. **Meta Ads (se aplicável):**
   - Incluir o App ID/domínio do Taskora na lista de clientes permitidos.
   - Gerar/fornecer um token Meta específico para o Taskora (armazenado no Secret Manager do projeto Taskora).
6. **Confirmar entrega:**
   - Responder com as strings dos tokens (ou confirmar que foram guardados em segredo seguro) e citar qualquer ACL/ajuste realizado.
   - Não alterar endpoints existentes; apenas adicionar as credenciais/whitelist necessárias.

> **Importante:** esse agente não precisa tocar no projeto Taskora. Toda a ação é dentro de `trae-appsaldos-473218-n7`, seguindo o passo a passo acima.
