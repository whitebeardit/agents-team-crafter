# Chat SDK e canais

**Propósito:** explicar como mensagens externas entram no BFF, como o `Chat` é instanciado por workspace/canal e como isso desemboca no runtime de agentes.  
**Público:** desenvolvedores de integrações e backend.

---

## Sumário

- [Visão geral](#visão-geral)
- [Plataformas suportadas](#plataformas-suportadas)
- [Webhooks e URLs](#webhooks-e-urls)
- [Estado: Redis vs memória](#estado-redis-vs-memória)
- [Fluxo até ao runtime](#fluxo-até-ao-runtime)
- [Ver também](#ver-também)

---

## Visão geral

O produto usa o pacote **`chat`** com adapters **`@chat-adapter/*`** para falar com Slack, Telegram, Discord, Teams, Google Chat, GitHub, Linear, WhatsApp, etc. A fábrica e o binding de eventos estão em [`backend/src/modules/chat-sdk/infra/workspace-chats.ts`](../../backend/src/modules/chat-sdk/infra/workspace-chats.ts).

Cada **canal** persistido no MongoDB (`Channel`) representa uma instância configurada (tokens, IDs de team Slack, modo webhook Telegram, …). Os webhooks **não** usam JWT de utilizador: o encaminhamento identifica **`workspaceId`** e **canal** a partir do path e da configuração.

---

## Plataformas suportadas

Enumeração de plataformas (segmento de URL / nome do adapter): [`backend/src/modules/channels/domain/chat-sdk-platform.ts`](../../backend/src/modules/channels/domain/chat-sdk-platform.ts) — `slack`, `discord`, `teams`, `telegram`, `gchat`, `github`, `linear`, `whatsapp`.

---

## Webhooks e URLs

Registo de rotas: [`backend/src/modules/chat-sdk/interfaces/chat-webhook.routes.ts`](../../backend/src/modules/chat-sdk/interfaces/chat-webhook.routes.ts).

Especificação completa (paths, Slack vs plataformas com `:channelId`, WhatsApp challenge): **[CHAT_SDK_TEAM_TRIGGER.md](../../docs/CHAT_SDK_TEAM_TRIGGER.md)**.

Resumo:

- **Slack** — `POST /api/v1/webhooks/chat/:workspaceId/slack`; resolução do documento `Channel` por `config.slackTeamId` e `team_id` do payload.
- **Outras** — `POST /api/v1/webhooks/chat/:workspaceId/:platform/:channelId` com `channelId` = ObjectId do documento `Channel` no MongoDB.

A UI expõe `webhookUrl` calculada com o host do pedido em `GET /channels` e `GET /channels/:id`.

---

## Estado: Redis vs memória

Em [`workspace-chats.ts`](../../backend/src/modules/chat-sdk/infra/workspace-chats.ts), `createStateAdapter`:

- Se **`REDIS_URL`** estiver definida — `@chat-adapter/state-redis` com prefixo `chat-sdk:{workspaceId}:` (isolamento por tenant no keyspace).
- Caso contrário — `@chat-adapter/state-memory` (adequado a desenvolvimento; não distribuído).

---

## Fluxo até ao runtime

1. Provedor externo chama o webhook.
2. O BFF valida assinatura / parâmetros conforme plataforma (detalhes no doc de triggers).
3. Carrega segredos do canal (cifrados ou fallback env em demo) e constrói `Chat` + adapter.
4. Em menções / threads subscritas, o handler inbound chama **`executeAgentRun`** (mesmo serviço usado por `POST /agents/:id/run`) com `channel` preenchido (ex.: `slack`), para formatação da mensagem do utilizador em [`format-agent-user-message`](../../backend/src/modules/runtime/application/format-agent-user-message.ts).

```mermaid
flowchart LR
  Ext[Plataforma externa]
  Hook[chat-webhook.routes]
  ChatMod[workspace-chats Chat]
  Run[executeAgentRun]

  Ext --> Hook
  Hook --> ChatMod
  ChatMod --> Run
```

---

## Ver também

- [AGENTS.md](./AGENTS.md) — diagrama global.
- [agents-and-handoff.md](./agents-and-handoff.md) — o que acontece dentro de `executeAgentRun`.
- [data-layer.md](./data-layer.md) — modelo `Channel` e segredos.
- [CHAT_SDK_TEAM_TRIGGER.md](../../docs/CHAT_SDK_TEAM_TRIGGER.md) — referência operacional completa.
