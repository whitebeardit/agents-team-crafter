# Documentação TeamAgents

Índice central para engenheiros que acabaram de clonar o repositório.

## Tem dúvidas? Pergunte à IA

Não precisa decorar 120 ficheiros de documentação. O [DeepWiki](https://deepwiki.com/whitebeardit/agents-team-crafter) responde em linguagem natural sobre como instalar, testar e entender o TeamAgents.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whitebeardit/agents-team-crafter)

**Exemplos do que pode perguntar:**

- "Como instalo o projeto pela primeira vez?"
- "Como funciona o AI Team Crafter?"
- "O que é o escritório virtual e como testo?"
- "Qual a diferença entre setup.sh e rodando-localmente?"

---

## Escolha o teu caminho

### 0 — Pergunte à IA

[DeepWiki](https://deepwiki.com/whitebeardit/agents-team-crafter) — atalho conversacional para dúvidas de uso, arquitetura e troubleshooting.

### 1 — Explorar (sem instalar)

[https://myteams.whitebeard.dev](https://myteams.whitebeard.dev) — demo online com dados de demonstração.

### 2 — Instalar em ~15 minutos

1. [getting-started.md](./getting-started.md) — fluxo único do clone ao primeiro run
2. [setup-wizard.md](./setup-wizard.md) — detalhes do `./setup.sh`
3. Validação: time **SO Clínica Conversacional** → Debug → `Cadastre um paciente`

### 3 — Desenvolver localmente

1. [rodando-localmente.md](./rodando-localmente.md) — instalação manual (Node, Mongo, Redis, `.env`)
2. [testing.md](./testing.md) — Jest, Playwright, gate de qualidade
3. [maturidade.md](./maturidade.md) — o que está pronto vs beta vs roadmap

---

## Features de referência (GOLD)

Guias hands-on por módulo em [features/](./features/):

| Feature | Guia |
| --- | --- |
| AI Team Crafter | [ai-team-crafter.md](./features/ai-team-crafter.md) |
| Runtime + Debug | [runtime-e-debug.md](./features/runtime-e-debug.md) |
| Escritório virtual | [escritorio-virtual.md](./features/escritorio-virtual.md) |
| Verticais de negócio | [verticais-negocio.md](./features/verticais-negocio.md) |
| Canais Chat SDK | [canais-chat-sdk.md](./features/canais-chat-sdk.md) |
| Second Brain | [second-brain.md](./features/second-brain.md) |
| Governança e observabilidade | [governanca-observabilidade.md](./features/governanca-observabilidade.md) |

---

## Referência técnica

| Documento | Conteúdo |
| --- | --- |
| [api/README.md](./api/README.md) | Referência REST do BFF |
| [../backend/src/app/routes.ts](../backend/src/app/routes.ts) | Rotas canónicas (fonte de verdade) |
| [../v0-team-ai-crafter/docs/AGENTS.md](../v0-team-ai-crafter/docs/AGENTS.md) | Wiki de arquitetura |
| [MULTI_TENANT.md](./MULTI_TENANT.md) | Isolamento e BYOK |
| [CHAT_SDK_TEAM_TRIGGER.md](./CHAT_SDK_TEAM_TRIGGER.md) | Webhooks de canais |
| [deploy.md](./deploy.md) | Produção (Coolify + Atlas) |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Como contribuir |

---

## Documentação interna (contribuidores)

A pasta [RALPHLOOP/](./RALPHLOOP/) contém especificações de evolução do produto e gates de qualidade — **não** é o ponto de entrada para iniciantes. Consulte apenas se for contribuir com código ou validar slices GOLD.

Os ficheiros `fase-1.md` … `fase-7.md` são **legado** do bootstrap inicial.
