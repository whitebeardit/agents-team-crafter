# Canais Chat SDK

## O que é

Os **canais** ligam Slack, Telegram, Discord, Teams, GitHub, Linear e outros ao mesmo runtime `invokeTeam` usado pelo Debug. A entrada é via **Chat SDK** e webhooks públicos.

## Por que é diferencial

A operação digital atende onde o negócio já está — sem forçar um único chat web.

## Como testar em 5 min

**Local (limitado):** Telegram/Slack exigem HTTPS público para webhooks. Em localhost, valide a configuração na UI:

1. **Canais** → criar canal Slack ou Telegram (Chat SDK)
2. Guarde segredos cifrados no workspace
3. Consulte URL de webhook em [CHAT_SDK_TEAM_TRIGGER.md](../CHAT_SDK_TEAM_TRIGGER.md)

**WhatsApp:** use Chat SDK — a conexão nativa na UI é **mock** (QR simulado).

## Pré-requisitos

- `REDIS_URL` recomendado para estado multi-instância
- Tokens do provider (Slack app, bot Telegram, etc.)
- Domínio público ou túnel (ngrok) para webhooks em dev

## Limitações

- E-mail inbound completo: roadmap
- WhatsApp nativo UI: mock — ver [maturidade.md](../maturidade.md)

## Onde está no código

- `backend/src/modules/chat-sdk/interfaces/chat-webhook.routes.ts`
- `docs/CHAT_SDK_TEAM_TRIGGER.md`
- `v0-team-ai-crafter/docs/chat-sdk.md`
