# Chat SDK: webhooks, segredos e disparo do coordenador

Este documento descreve como configurar canais **Chat SDK** (`provider: 'chat_sdk'`) para que mensagens entrantes disparem o **coordenador** do time correto. Está alinhado ao código em [`backend/src/modules/chat-sdk/`](../backend/src/modules/chat-sdk/) e [`backend/src/modules/channels/`](../backend/src/modules/channels/).

## Conceitos

1. **Agente coordenador** — único papel que pode ter `channels[]` e `channelConfig` de entrada externa.
2. **Instância `Channel`** (Mongo) — `type`, `provider`, `platform`, `config` (roteamento / metadados públicos), `secretsEncrypted` (segredos cifrados).
3. **Time** — `channelIds` aponta para instâncias de canal; apenas times **`active`** participam do roteamento inbound.
4. **Regra MVP (1:1)** — o mesmo `channelId` não pode estar em `channelIds` de **dois times ativos** ao mesmo tempo no mesmo workspace.

## Pré-requisitos comuns

| Item | Descrição |
|------|-----------|
| `ENCRYPTION_MASTER_KEY` | 64 caracteres hex (32 bytes). Obrigatório no servidor para **persistir** segredos via `PUT /channels/:id/secrets`. Ver `backend/.env.example`. |
| `PUT /channels/:id/secrets` | Corpo JSON com `platform` e campos de segredo por plataforma. Exige **admin** ou **owner** no workspace (`requireAdmin`). |
| `PUT /channels/:id` | Atualiza `config` (ex.: `slackTeamId`, `discordGuildId`). Autenticação normal com tenant. |
| `REDIS_URL` | (Opcional) estado do Chat SDK entre réplicas (`@chat-adapter/state-redis`). **Recomendado em produção** com várias instâncias do BFF para `GET /teams/:id/live` (pub/sub de progresso do time). Sem Redis, o live do grafo funciona só dentro do mesmo processo Node. |
| Frontend | Página **Canais** (`v0-team-ai-crafter`) — criação por plataforma Chat SDK e diálogo **Configurar** (roteamento JSON + segredos). |

Segredos **nunca** são devolvidos em texto claro no `GET /channels` ou `GET /channels/:id`; apenas `secretsMasked` (máscara).

## URLs de webhook (públicas, sem JWT)

Prefixo: `/api/v1/webhooks/chat`

| Plataforma | Método(s) | Caminho |
|------------|-----------|---------|
| **slack** | `POST` | `/:workspaceId/slack` |
| **discord**, **teams**, **telegram**, **gchat**, **github**, **linear** | `POST` | `/:workspaceId/:platform/:channelId` |
| **whatsapp** | `GET`, `POST` | `/:workspaceId/whatsapp/:channelId` (`GET` = challenge Meta) |

- `workspaceId` — ObjectId do workspace (igual ao contexto autenticado / `X-Workspace-Id`).
- `channelId` — ObjectId do **documento** `Channel` no Mongo (não confundir com ID de canal Slack/Discord).

O backend devolve `webhookUrl` calculada em `GET /channels` e `GET /channels/:id` (com host do request).

## Slack

### Arquivos / código relevantes

- Webhook: [`chat-webhook.routes.ts`](../backend/src/modules/chat-sdk/interfaces/chat-webhook.routes.ts)
- Segredos com fallback env: [`resolve-slack-secrets.ts`](../backend/src/modules/chat-sdk/application/resolve-slack-secrets.ts)
- Schema: [`chat-sdk-secrets.schema.ts`](../backend/src/modules/channels/domain/chat-sdk-secrets.schema.ts) (`slackSecretsBody`)

### Config do canal (`config`)

| Chave | Obrigatório | Descrição |
|-------|-------------|-----------|
| `slackTeamId` | Sim (produção) | Team ID `T…` presente em `event_callback.team_id` |
| `botTokenEnvKey` | Não | Nome da env var do token (fallback legado); padrão `SLACK_BOT_TOKEN` |

### Segredos recomendados (banco, cifrados)

`PUT /api/v1/channels/:id/secrets` (admin):

```json
{
  "platform": "slack",
  "signingSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "botToken": "xoxb-..."
}
```

### Fallback sem blob cifrado (migração)

Se o canal **não** tiver `secretsEncrypted`, ainda é possível usar:

- `SLACK_SIGNING_SECRET` + token em `SLACK_BOT_TOKEN` (ou env apontada por `botTokenEnvKey`).

### URL do webhook (Slack API)

```
POST https://<host>/api/v1/webhooks/chat/<workspaceId>/slack
```

### Fluxo de disparo

1. Slack envia `event_callback` para a URL acima.
2. O backend resolve o canal com `config.slackTeamId === team_id`.
3. Carrega segredos (cifrados ou fallback env), instancia `Chat` + `@chat-adapter/slack`.
4. Em menção / thread inscrita → `invokeTeam` com `TeamInvocation` (`trigger: chat`); metadados de canal só no contexto do coordenador.

---

## Discord

### Onde obter cada valor (Discord Developer Portal)

| Campo no `PUT .../secrets` | Onde obter |
|----------------------------|------------|
| `botToken` | **Bot** → *Reset Token* / token do bot |
| `publicKey` | **General Information** → *Public Key* (string hex) |
| `applicationId` | (Opcional) **General Information** → *Application ID* |

Não há “arquivo” obrigatório no repositório: tudo vem do portal e é colado na API ou no formulário da UI.

### Criar o canal (exemplo API)

`POST /api/v1/channels` (com JWT + workspace):

```json
{
  "type": "discord",
  "name": "Discord (Chat SDK)",
  "provider": "chat_sdk",
  "platform": "discord",
  "config": {
    "discordGuildId": "987654321098765432"
  }
}
```

`discordGuildId` documenta o servidor; o **roteamento do webhook** usa o `channelId` na URL, não o guild no payload.

### Segredos (exemplo)

```json
{
  "platform": "discord",
  "botToken": "MTQ...replaced...",
  "publicKey": "a1b2c3d4e5f6...",
  "applicationId": "1234567890123456789"
}
```

### URL a registrar no Discord (Interactions Endpoint URL)

```
https://<host>/api/v1/webhooks/chat/<workspaceId>/discord/<channelId>
```

Em **General Information** → *Interactions Endpoint URL*, use essa URL exata (HTTPS em produção).

### Comportamento técnico

- O adapter valida assinatura Ed25519 (`X-Signature-Ed25519`, `X-Signature-Timestamp`) com `publicKey`.
- Respostas a PING e interações seguem o pacote `@chat-adapter/discord` / `chat`.

---

## Telegram

### Onde obter cada valor

| Campo | Onde obter |
|-------|------------|
| `botToken` | **@BotFather** → `/newbot` ou *API Token* do bot existente (formato `123456789:AAH...`) |
| `secretToken` | (Opcional) string que **você define**; deve ser a mesma enviada ao `setWebhook` como `secret_token` |

### Criar o canal (exemplo API)

```json
{
  "type": "telegram",
  "name": "Telegram (Chat SDK)",
  "provider": "chat_sdk",
  "platform": "telegram",
  "config": {}
}
```

`config` pode permanecer vazio; a identificação do canal na entrada é pela URL do webhook (inclui `channelId`).

### Segredos (exemplo)

```json
{
  "platform": "telegram",
  "botToken": "123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "secretToken": "um-segredo-longo-aleatorio-opcional"
}
```

Se `secretToken` for omitido, não configure `secret_token` no `setWebhook`.

### Registrar o webhook no Telegram (obrigatório)

Chamada HTTP à API do Telegram (substitua `<BOT_TOKEN>` e a URL):

```http
POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
Content-Type: application/json

{
  "url": "https://<host>/api/v1/webhooks/chat/<workspaceId>/telegram/<channelId>",
  "secret_token": "um-segredo-longo-aleatorio-opcional"
}
```

Remova `secret_token` do JSON se não usar `secretToken` nos segredos salvos.

O backend usa o adapter em modo **webhook** (`createTelegramAdapter` com `mode: 'webhook'`).

### API: registar webhook (admin)

Com segredos Telegram já gravados (`PUT /channels/:id/secrets`), **owner/admin** pode chamar:

`POST /api/v1/channels/:id/telegram/register-webhook` (JWT + `X-Workspace-Id`).

O servidor monta a mesma `webhookUrl` que `GET /channels` (a partir de `Host` / `X-Forwarded-Proto` do pedido), chama `setWebhook` na API do Telegram e devolve `setWebhook` + `getWebhookInfo` no envelope de sucesso. Em falha do Telegram, resposta **502** com mensagem descritiva.

### Scripts auxiliares (backend)

- Verificar times ativos, `channelIds` e conflitos no Mongo: `npm run verify:team-channels` (env: `MONGODB_URI`; opcional `WORKSPACE_ID` ou `WORKSPACE_NAME`, padrão `Workspace Alpha`).
- Registrar webhook no Telegram (alternativa à API/UI): `npm run telegram:set-webhook` com `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL` (URL completa como em `GET /channels`), opcional `TELEGRAM_SECRET_TOKEN`.

**GitHub:** configure o webhook do repositório em *Settings → Webhooks* com `POST https://<host>/api/v1/webhooks/chat/<workspaceId>/github/<channelId>` e o mesmo `webhookSecret` gravado em `PUT /channels/:id/secrets` (`platform: "github"`).

---

## Outras plataformas (resumo de chaves)

Schemas completos: [`chat-sdk-secrets.schema.ts`](../backend/src/modules/channels/domain/chat-sdk-secrets.schema.ts).

Todas usam webhook `POST .../:workspaceId/:platform/:channelId`, exceto Slack (acima) e WhatsApp (`GET`+`POST`).

| Plataforma | `platform` em `PUT .../secrets` | Campos principais de segredo |
|------------|-----------------------------------|--------------------------------|
| Microsoft Teams | `teams` | `appId`, `appPassword`, opc. `appTenantId`, `appType` |
| Google Chat | `gchat` | `credentialsJson` (JSON string da service account), opc. `googleChatProjectNumber`, `impersonateUser` |
| GitHub | `github` | `webhookSecret`; e **um** modo: `token` (PAT) **ou** `appId`+`privateKey`+opc. `installationId` (GitHub App) |
| Linear | `linear` | `webhookSecret`; e auth: `apiKey` **ou** `accessToken` **ou** `clientId`+`clientSecret` |
| WhatsApp Cloud | `whatsapp` | `accessToken`, `appSecret`, `verifyToken`; `config.whatsappPhoneNumberId` obrigatório no documento |

---

## Live no grafo (inbound) e feedback no Telegram

### `GET /api/v1/teams/:id/live` (SSE, autenticado)

- Eventos alinhados a `POST /api/v1/teams/:id/run/stream`: `agentStatus`, `coordinatorDelta`, `runComplete`, `error`, e adicionalmente **`inboundUserMessage`** (início de um run vindo do Chat SDK, antes de `invokeTeam`).
- Payload de `inboundUserMessage`: `channel` (ex.: `telegram`), `text`, `teamId`, `channelId`, `workspaceId`.
- Em `coordinatorDelta` (GET live), o JSON inclui **`source`**: `inbound` ou `manual`, tal como em `runComplete`, para o frontend filtrar o espelho (ex.: acumular texto só para inbound).
- Runs **inbound** publicam `coordinatorDelta` no bus (texto do coordenador em streaming), igual ao `POST .../run/stream` manual.
- Em `runComplete`, o JSON inclui **`source`**: `inbound` (webhook Chat SDK) ou `manual` (consola / `POST .../run/stream`), para o frontend distinguir espelho vs. envio local.
- O backend publica num bus por time; falhas ao escrever no SSE **não** devem propagar para o webhook (listeners e `publish` em memória isolados com `try/catch`).
- Os envelopes devem ser **JSON-serializáveis**. Se `JSON.stringify` falhar (ex.: referência circular em `data`), o broadcast usa um envelope mínimo de erro ou ignora o publish — **nunca** interrompe o fluxo inbound nem impede `postCoordinatorExternalResponse` de enviar a resposta ao Telegram.
- O editor de grafo (`/teams/[id]/graph`, modo Live) subscreve este GET para o grafo e, na mesma ligação, alimenta o **espelho** no painel “Console em tempo real” (mensagem inbound + resposta quando `source === 'inbound'`).
- Cada `agentStatus` inclui `runId` para correlacionar com `runComplete`.

### Telegram: indicador "a escrever"

- Enquanto o coordenador e os especialistas processam, o adaptador Telegram renova `sendChatAction` com `action=typing` (via `startTyping` do `@chat-adapter/telegram`) até a resposta final ser enviada.
- Aplica-se a **todos** os canais Telegram do workspace que usem o mesmo fluxo inbound.

### Telegram: mensagens curtas de estado (debounce)

- Durante a fase **`specialist`** com `status: busy`, o backend pode enviar **mensagens de texto** opcionais (`thread.post`) com um resumo da tarefa (truncado), no máximo **uma por intervalo** (~9s por defeito), para não spammar o chat. Erros do Telegram são ignorados (não abortam o run).
- Complementa o indicador "a escrever"; não substitui a resposta final do coordenador.

### Telegram: resposta final (`postCoordinatorExternalResponse`)

- O envio da resposta do coordenador ao chat usa o adaptador com `parse_mode` **Markdown (legacy)** quando o runtime marca `format: markdown`. Texto com muitos blocos de código, `**` ou caracteres especiais pode fazer a API do Telegram devolver erro de entidades; nesse caso o backend **tenta de novo** com texto **simples** (sem `parse_mode`), para a mensagem chegar ao utilizador.
- Em **429** (rate limit), o código faz **uma** nova tentativa após o intervalo indicado pelo Telegram (`retry_after`, até um teto).
- Texto vazio (após trim) envia um placeholder curto em vez de falhar com “mensagem vazia”.
- Erros no fallback são registados em `console.warn` com contexto (`markdown_fallback`, `empty_skip`).
- Falhas ao enviar a resposta final são registadas em `console.error` (`[postCoordinatorExternalResponse] inbound failed`); o erro **repropaga-se** para o handler do webhook (comportamento explícito para diagnóstico e para o Telegram poder repetir o update se aplicável).

### Limitações

- Runs concorrentes no mesmo time podem sobrepor estados no grafo (chave por `agentId`); `runId` permite evoluir a UI para filas ou último run.
- Sem `REDIS_URL`, o SSE live só vê eventos publicados **na mesma instância** do servidor que trata o webhook.
- Com Live **desligado**, o espelho no console é limpo; mensagens inbound aparecem apenas no canal externo (ex.: Telegram). A consola continua a usar `POST .../run/stream` apenas para mensagens escritas localmente.

---

## OpenAI Agent SDK

O runtime envia `channel` como prefixo na mensagem do usuário (`[channel=slack]`, `[channel=discord]`, etc.), via `formatAgentUserMessage`.

## Evolução

- `Channel.config.routing.primaryTeamId` — reservado para desambiguar múltiplos times.
- OAuth por plataforma — pode complementar o modelo de segredos cifrados (tokens de refresh).

## Testes

- Team runtime (coordenador + tools, sem cadeia de handoff): `backend/src/__tests__/runtime-orchestration.integration.test.ts`, `backend/src/__tests__/runtime-run.integration.test.ts`
- Binding 1:1: `backend/src/__tests__/team-active-channel-binding.integration.test.ts`
- Resolução 0/1/N: `backend/src/modules/chat-sdk/application/resolve-inbound-coordinator.test.ts`
- Texto com canal: `backend/src/modules/runtime/application/format-agent-user-message.test.ts`
- Cifragem: `backend/src/utils/secrets-crypto.test.ts`
- Live broadcast: `backend/src/modules/teams/infrastructure/team-live-broadcaster.test.ts` (inclui payload não serializável em `publish`)
- Telegram typing: `backend/src/modules/chat-sdk/infra/telegram-typing-loop.test.ts`
- Telegram estado inbound (debounce): `backend/src/modules/chat-sdk/infra/telegram-inbound-status-debouncer.test.ts`
- Resposta final inbound (Telegram fallback / 429): `backend/src/modules/chat-sdk/infra/post-coordinator-external-response.test.ts`
