# TeamAgentsAICrafter

> *Destaque: com `EMBEDDINGS_ENABLED=1`, o Second Brain passa a recuperar conhecimento por significado, melhorar o contexto dos agentes e achar notas úteis mesmo quando o texto não bate literalmente.*

Plataforma SaaS para criacao e gerenciamento de times de agentes de IA com editor visual de grafo.

> **Pergunte à IA** como usar ou como funciona o projeto (instalação, features, APIs):
> [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whitebeardit/agents-team-crafter)

> ## 🚀 Demo online (rodando agora)
>
> **Acesse:** **https://myteams.whitebeard.dev**
>
> Ambiente publico para explorar o produto em execução e validar os fluxos principais ponta a ponta.

## 🌟 Hero docs (visão rápida do produto)

Este README agora funciona como uma documentação **Hero**: uma visão clara, objetiva e navegável para entender o valor do produto em poucos minutos e depois aprofundar por módulo.

### O que você consegue fazer na plataforma

- **Criar agentes especializados** com instruções, capacidades e configurações versionadas por workspace.
- **Montar times multiagente** com coordenador + especialistas e orquestração por runtime.
- **Modelar fluxos visualmente** no editor de grafo (`/teams/[id]/graph`).
- **Executar operações reais** em canais externos (Slack/Telegram e outros adapters via Chat SDK).
- **Operar em modo SaaS multi-tenant** com isolamento por `workspaceId` e segredos cifrados.
- **Governar e auditar** execuções, métricas e configurações de forma centralizada.
- **Escalar com templates** para replicar padrões de times e acelerar onboarding.

### Jornada recomendada (5 minutos)

1. Entre no **demo online**: https://myteams.whitebeard.dev
2. Abra **Dashboard** para visão de métricas e estado operacional.
3. Explore **Agents** e **Teams** para entender composição coordenador/especialistas.
4. Visite o **Graph Editor** para ver a modelagem visual dos fluxos.
5. Revise **Channels** e **Settings** para integração e governança multi-tenant.

**Arquitetura (wiki):** visão multi-tenant, diagramas e documentação por camada em [docs/AGENTS.md](./docs/AGENTS.md).

**Visão geral do produto (screenshots, Telegram, tour da UI):** ver o [README na raiz do monorepo](../README.md).

## Sumario

- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Rotas da Aplicacao](#rotas-da-aplicacao)
- [Documentação relacionada](#documentação-relacionada)
- [API BFF (resumo)](#api-bff-resumo)
- [Tipos TypeScript](#tipos-typescript)
- [Testes](#testes)

---

## Requisitos

- **Node.js** conforme `engines` em `[package.json](./package.json)` (atualmente >= 20.19, com faixas 22/24 suportadas)
- **npm** (este app usa `[package-lock.json](./package-lock.json)`; nao ha lockfile pnpm neste pacote)
- MongoDB >= 6.x (recomendado)
- Redis opcional no **BFF** para estado persistente do Chat SDK (`REDIS_URL` em `backend/.env`; ver [CHAT_SDK_TEAM_TRIGGER.md](../docs/CHAT_SDK_TEAM_TRIGGER.md))

## Instalacao

> Para instalar e testar o projeto completo pela primeira vez, use [docs/getting-started.md](../docs/getting-started.md) ou o wizard [`./setup.sh`](../setup.sh).
> Guia manual: [docs/rodando-localmente.md](../docs/rodando-localmente.md).

No **monorepo** `[agents-team-crafter](../README.md)`, a app Next.js fica em `v0-team-ai-crafter/`:

```bash
cd v0-team-ai-crafter

# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.example .env.local

# Rodar em desenvolvimento
npm run dev

# Build para producao
npm run build
npm start
```

No **backend** (BFF), com MongoDB no ar, rode `npm run seed` para criar dados de demo. Depois faça login no app com **[admin@whitebeard.dev](mailto:admin@whitebeard.dev)** / **Admin123!** (somente desenvolvimento).

### Testes E2E (Playwright)

- Instalar browser uma vez: `npm run test:e2e:install`
- Com **BFF** (`:3001`) e **Next** (`:3000`) no ar, e o mesmo utilizador com workspace (ex.: seed acima):

```bash
E2E_API_URL=http://127.0.0.1:3001/api/v1 \
E2E_USER_EMAIL=admin@whitebeard.dev \
E2E_USER_PASSWORD='Admin123!' \
E2E_BASE_URL=http://127.0.0.1:3000 \
npm run test:e2e
```

- Sem `E2E_API_URL` / email / password, a suíte **marca os testes como skipped** (exit 0), para não bloquear CI ou o gate local.
- O `global-setup` grava `e2e/.auth/storageState.json` (gitignored) com o estado Zustand (`teamagents-workspace`) após login na API.

## Variaveis de Ambiente

O produto e **multi-tenant**: credenciais de clientes (OpenAI, SMTP, Slack, etc.) ficam no **workspace**, cifradas no MongoDB (`ENCRYPTION_MASTER_KEY` no BFF). Ver [docs/MULTI_TENANT.md](../docs/MULTI_TENANT.md).

**Frontend (`.env.local`):**

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Com `npm run dev`, o Next.js usa por defeito a porta **3000** — alinhe `NEXT_PUBLIC_APP_URL` ao host que abrir no browser. No **Docker Compose** da raiz do monorepo, o default da porta no host do frontend é **3002** (`FRONTEND_PORT`); use `NEXT_PUBLIC_APP_URL` coerente com esse URL ou com o domínio público (ex.: Coolify).

**Backend (`backend/.env`)** — segredos **so de instancia**:

```env
MONGODB_URI=mongodb://localhost:27017/teamagents
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**Second Brain / embeddings** — opcional, mas útil quando você quer que o sistema recupere conhecimento por *significado* e não só por palavra:

- `EMBEDDINGS_ENABLED=1` ativa busca semântica no vault
- `OPENAI_API_KEY` passa a ser necessário para gerar embeddings
- ganho prático: melhores memórias recuperadas, contexto mais relevante para os agentes e menos dependência de correspondência literal
- com isso ligado, o sistema também re-embeda notas quando o conteúdo muda


**Fallback apenas para demo local** (quando o workspace ainda nao tem chave na UI): `OPENAI_API_KEY`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`. Nao usar para producao multi-tenant. Detalhes em `backend/.env.example`.

## Estrutura do Projeto

```
/
├── app/
│   ├── (app)/                    # Rotas autenticadas
│   │   ├── dashboard/            # Dashboard principal
│   │   ├── agents/               # Catalogo e criacao de agentes
│   │   │   ├── create/           # Wizard criar agente
│   │   │   └── [id]/             # Detalhe do agente
│   │   ├── governance/           # Analytics e operacoes de governance
│   │   ├── runs/                 # Historico de execucoes
│   │   ├── tool-definitions/     # Definicoes de tools (admin)
│   │   ├── teams/                # Listagem e gestao de times
│   │   │   ├── [id]/             # Detalhes do time
│   │   │   │   ├── graph/        # Editor de grafo
│   │   │   │   ├── office/       # Escritorio virtual
│   │   │   │   └── gallery/      # Galeria (time)
│   │   │   ├── create/           # Wizard criar time
│   │   │   └── ai-create/        # Criacao assistida por IA
│   │   ├── templates/            # Templates de times
│   │   ├── channels/             # Canais de comunicacao
│   │   ├── schedule/             # Agenda (vertical scheduling na UI)
│   │   ├── crm/                  # CRM (clientes/parties no workspace)
│   │   ├── observability/        # Observabilidade operacional
│   │   └── settings/             # Configuracoes
│   ├── invite/[inviteId]/        # Aceitar convite de workspace
│   ├── login/                    # Pagina de login
│   ├── register/                 # Cadastro de usuario
│   └── layout.tsx                # Layout raiz
├── components/
│   ├── agents/                   # Componentes de agentes
│   ├── channels/                 # Componentes de canais
│   ├── graph/                    # Componentes do editor de grafo
│   ├── layout/                   # Sidebar, Header
│   ├── teams/                    # Componentes de times
│   ├── templates/                # Componentes de templates
│   └── ui/                       # Componentes shadcn/ui
├── lib/
│   ├── data/                     # Dados mockados
│   ├── governance/               # Helpers (ex.: export de auditoria)
│   ├── store/                    # Zustand stores
│   ├── types/                    # Tipos TypeScript
│   └── utils.ts                  # Utilitarios
└── public/                       # Assets estaticos
```

## Rotas da Aplicacao

Superficies de **negócio** com página dedicada (ex.: `/crm`, `/schedule`) coexistem com o núcleo do produto (times, agentes, canais). Outras verticais do BFF (care, finance, clinical, …) podem ganhar rota equivalente quando houver UI — até lá operam via **runtime de tools** e canais. Itens da barra lateral: `[components/layout/app-navigation.tsx](./components/layout/app-navigation.tsx)`.


| Rota                  | Descricao                                                                          |
| --------------------- | ---------------------------------------------------------------------------------- |
| `/`                   | Redirect para `/login` ou `/dashboard`                                             |
| `/login`              | Pagina de autenticacao                                                             |
| `/register`           | Cadastro de novo usuario                                                           |
| `/invite/[inviteId]`  | Aceitar convite para workspace                                                     |
| `/dashboard`          | Dashboard principal com metricas                                                   |
| `/agents`             | Catalogo de agentes disponiveis                                                    |
| `/agents/create`      | Wizard de criacao de agente                                                        |
| `/agents/[id]`        | Detalhe de um agente; exportar ou copiar JSON (`GET /api/v1/agents/:id/export`)    |
| `/governance`         | Painel de governance (metricas, auditoria)                                         |
| `/runs`               | Historico de execucoes de times                                                    |
| `/tool-definitions`   | Gestao de definicoes de tools (conforme permissao)                                 |
| `/teams`              | Listagem de times                                                                  |
| `/teams/create`       | Wizard de criacao de time (5 etapas)                                               |
| `/teams/ai-create`    | Fluxo de criacao de time assistido por IA                                          |
| `/teams/[id]`         | Detalhes do time; exportar ou copiar JSON do time (`GET /api/v1/teams/:id/export`) |
| `/teams/[id]/graph`   | Editor visual de grafo do time                                                     |
| `/teams/[id]/office`  | Escritorio virtual (canvas, timeline, replay)                                      |
| `/teams/[id]/gallery` | Galeria associada ao time                                                          |
| `/templates`          | Galeria de templates                                                               |
| `/channels`           | Gestao de canais                                                                   |
| `/schedule`           | Agenda (scheduling)                                                                |
| `/crm`                | CRM — clientes/parties do workspace                                                |
| `/observability`      | Observabilidade operacional                                                        |
| `/settings`           | Configuracoes do workspace e perfil                                                |

---

## Documentação relacionada

| Documento | Conteúdo |
| --- | --- |
| [docs/README.md](../docs/README.md) | Índice central — instalar, testar, features |
| [docs/getting-started.md](../docs/getting-started.md) | Guia de 15 minutos |
| [docs/api/README.md](../docs/api/README.md) | Referência REST completa do BFF |
| [backend/src/app/routes.ts](../backend/src/app/routes.ts) | Lista **canónica** de rotas (evita drift) |
| [docs/AGENTS.md](./docs/AGENTS.md) | Wiki de arquitetura multi-tenant |
| [docs/testing.md](../docs/testing.md) | Jest, Playwright, gate de qualidade |

## API BFF (resumo)

Base URL: `{API_URL}/api/v1`

```http
Authorization: Bearer {jwt_token}
X-Workspace-Id: {workspace_id}
```

A documentação REST completa (~2800 linhas) foi movida para **[docs/api/README.md](../docs/api/README.md)** para reduzir drift e manter este README focado no frontend.

**Fontes canónicas:**

- Rotas registadas: [`backend/src/app/routes.ts`](../backend/src/app/routes.ts)
- Camada BFF: [docs/backend-api.md](./docs/backend-api.md)
- Webhooks Chat SDK: [CHAT_SDK_TEAM_TRIGGER.md](../docs/CHAT_SDK_TEAM_TRIGGER.md)
- Maturidade (pronto vs mock): [docs/maturidade.md](../docs/maturidade.md)

## Tipos TypeScript

**Fonte de verdade:** [`lib/types/index.ts`](./lib/types/index.ts). Importe tipos a partir desse módulo; não copie blocos longos de documentação para evitar drift.

## Testes

Ver [docs/testing.md](../docs/testing.md) — Jest no backend, Playwright E2E neste pacote, gate `./scripts/ralph-loop-gate.sh`.

## Suporte

- [DeepWiki — pergunte à IA](https://deepwiki.com/whitebeardit/agents-team-crafter)
- Demo: https://myteams.whitebeard.dev
- Issues no repositório GitHub
