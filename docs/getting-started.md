# Getting started — 15 minutos

Guia único para validar o TeamAgents no seu clone: do zero ao primeiro run no Debug.

> **Preferes conversar?** Pergunte à IA no [DeepWiki](https://deepwiki.com/whitebeardit/agents-team-crafter) — instalação, features e troubleshooting em linguagem natural.
>
> [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/whitebeardit/agents-team-crafter)

## Pré-requisitos

- Git, Docker (rootless recomendado), chave LLM (OpenRouter ou OpenAI)
- ~20 minutos na primeira vez (download de imagens Docker)

## Passo a passo

### 1. Clone e wizard

```bash
git clone <url-do-repositorio> agents-team-crafter
cd agents-team-crafter
./setup.sh
```

**Escolhas recomendadas:**

| Pergunta | Resposta |
| --- | --- |
| Configurar IA? | **Sim** — OpenRouter ou OpenAI |
| Importar time SO? | **Sim** — JSON bundled (offline) |
| Slack / Telegram | **Não** (configurar depois) |

Cole **apenas** o valor da chave API (`sk-or-v1-...`), sem prefixo `OPENROUTER_API_KEY=`.

Detalhes: [setup-wizard.md](./setup-wizard.md).

### 2. Login

| Item | Valor |
| --- | --- |
| App | http://localhost:3002 |
| Email | admin@whitebeard.dev |
| Senha | Admin123! |

> **Dev manual** (`npm run dev`): frontend em http://localhost:3000 — ver [rodando-localmente.md](./rodando-localmente.md).

### 3. Validar o runtime (SO Clínica)

1. Abra o time **SO Clínica Conversacional**
2. Aba **Debug**
3. Envie: `Cadastre um paciente`
4. O coordenador deve responder **sem** erro 400/401

Se falhar com 401, verifique a chave LLM no `.env` (sem prefixo de variável). Ver [setup-wizard.md#problemas-comuns](./setup-wizard.md#problemas-comuns).

### 4. Escritório virtual (opcional)

1. No mesmo time, abra **Escritório virtual** (`/teams/[id]/office`)
2. Envie outro prompt no Debug
3. Observe a timeline e o canvas em tempo real

Guia: [features/escritorio-virtual.md](./features/escritorio-virtual.md).

### 5. Explorar mais (opcional)

| O quê | Onde |
| --- | --- |
| CRM | `/crm` |
| Agenda | `/schedule` |
| AI Team Crafter | `/teams/ai-create` |
| Second Brain | Settings → Memória do time |

Índice de features: [features/](./features/).

### 6. Testes automatizados (opcional)

```bash
cd backend && npm test
```

Mais opções: [testing.md](./testing.md).

## Próximos passos

- [maturidade.md](./maturidade.md) — o que pode demonstrar com confiança
- [rodando-localmente.md](./rodando-localmente.md) — desenvolvimento manual sem wizard
- [README.md](./README.md) — índice completo
