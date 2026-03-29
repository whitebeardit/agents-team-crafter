# Stack do backend (Team Agents BFF)

## Framework HTTP

Este repositório usa **Fastify 5** para o BFF (`backend/src/app/`).

O arquivo `AGENTS.md` na raiz do workspace pode citar **Express** como convenção genérica de projetos; **neste serviço, a implementação é Fastify**. Novas rotas (incluindo webhooks Chat SDK) devem seguir os padrões Fastify já usados em `src/modules/*/interfaces/*routes.ts`.

## Variáveis de ambiente relevantes

| Variável | Uso |
|----------|-----|
| `ENCRYPTION_MASTER_KEY` | 64 hex chars (32 bytes): cifra segredos de **canal** e blob `Workspace.integrationSecretsEncrypted` (`PUT /settings/workspace/integrations`, `PUT /channels/:id/secrets`) |
| `OPENAI_API_KEY` | Opcional: fallback de demo quando o workspace não tem chave BYOK em integrações |
| `REDIS_URL` | Estado persistente do Chat SDK (`@chat-adapter/state-redis`) |
| `SLACK_SIGNING_SECRET` | Slack: fallback de demo / migração (depois de `Workspace` ou canal com segredos cifrados) |
| `SLACK_BOT_TOKEN` | Slack: token do bot (fallback; ou `Channel.config.botTokenEnvKey`) |
| `CHAT_SDK_SKIP_SIGNATURE_VERIFY=1` | Apenas testes (`NODE_ENV=test`): pular assinatura Slack |

Rotas: `GET/PUT /api/v1/settings/workspace/integrations`, `POST .../test-openai`, `POST .../test-smtp`. Ver [MULTI_TENANT.md](MULTI_TENANT.md).

Ver `src/config/env.ts` para o schema completo.

Documentação de webhooks e exemplos (Slack, Discord, Telegram, etc.): [`docs/CHAT_SDK_TEAM_TRIGGER.md`](CHAT_SDK_TEAM_TRIGGER.md).
