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
| `REDIS_URL` | (Opcional) estado do Chat SDK entre réplicas (`@chat-adapter/state-redis`). |
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
