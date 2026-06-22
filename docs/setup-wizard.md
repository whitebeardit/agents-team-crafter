# Wizard de instalação (primeira vez)

Guia para instalar o **TeamAgents / agents-team-crafter** numa máquina nova, sem conhecimento técnico avançado.

O wizard usa **Docker Compose** com **MongoDB local**, **Redis**, backend e frontend. Dados da aplicação (`data/`) ficam no clone; o daemon Docker rootless é **isolado por projeto** e não altera o Docker system-wide.

## Pré-requisitos

1. **Node.js 20+** e **npm**
2. **Docker rootless** (user-level — não mexe em `/etc/docker/daemon.json`):
   - [Documentação oficial](https://docs.docker.com/engine/security/rootless/)
   - Instalação rápida: `curl -fsSL https://get.docker.com/rootless | sh` e `export PATH=$HOME/bin:$PATH`
3. **Espaço em disco** no volume onde clona o projeto (recomendado ≥ 8 GB livres na primeira instalação)
4. Clone num path com espaço (ex.: `/media/whitebeard/OS/DEV/`)

## Instalação

```bash
git clone <url-do-repositorio> /media/whitebeard/OS/DEV/agents-team-crafter
cd /media/whitebeard/OS/DEV/agents-team-crafter
./setup.sh
```

O assistente pergunta:

- Se quer configurar **IA** (OpenRouter ou OpenAI) — opcional
- Se quer instalar o time demo **SO Clínica Conversacional** (7 agentes, internal actions) — **recomendado** para ver a plataforma com tools reais
  - **Exportar do site demo** e importar na UI local, ou
  - **Importar do JSON incluído** no assistente (offline / mais rápido)
  - Depois pode criar o seu time e partilhá-lo via Exportar/Importar JSON entre workspaces ou instalações
- **Slack** e **GitHub** — opcionais
- **Telegram** — **recomendado**, mas pode **pular**

Secrets base (`JWT`, `ENCRYPTION_MASTER_KEY`) são gerados automaticamente.

**Chave de IA:** cole **apenas o valor** (ex.: `sk-or-v1-...`), **sem** `OPENROUTER_API_KEY=` ou `OPENAI_API_KEY=`. O wizard valida a chave com o provider antes de concluir; se colar a linha completa do `.env`, a autenticação falha com `401 Missing Authentication header` na consola do time.

## SO · Clínica Gold (time demo)

Recomendamos importar um **time de demonstração com 7 agentes** (coordenadora + especialistas) para ver a plataforma em acção. O time **SO Clínica Conversacional** (domínio Clínica Gold) inclui **internal actions** (`clinic_*`) — ferramentas de negócio reais que demonstram orquestração, contexto clínico e delegação entre especialistas (ex.: cadastro de paciente, agenda, CRM clínico).

Depois pode **criar o seu próprio time** na UI, **exportar JSON** (detalhe do time → «Exportar JSON») e **importar** noutro workspace ou noutra instalação TeamAgents.

| Opção no wizard | Manifest | Pós-setup |
|-----------------|----------|-----------|
| Exportar do [site demo](https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34) e importar na UI | `soTeamSource: demo-manual` | Guia passo a passo (sem auto-import) |
| Importar do JSON incluído no assistente | `soTeamSource: bundled` | `POST /api/v1/teams/import` automático |

JSON bundled (versionado): `scripts/setup/data/team-so-clinica-conversacional.json`

**Validar instalação:** abra o time SO → aba **Debug** → envie:

```
Cadastre um paciente
```

### Variáveis (CI / não interactivo)

| Variável | Efeito |
|----------|--------|
| `SETUP_ENABLE_SO_CLINIC=0` | Pula a secção SO |
| `SETUP_SO_TEAM_SOURCE=demo` | Origem demo (`demo-manual`) |
| `SETUP_SO_TEAM_SOURCE=bundled` | Import automático do JSON bundled (default CI) |

## Depois da instalação

| Item | Valor |
|------|--------|
| App | http://localhost:3002 |
| API | http://localhost:3001/api/v1 |
| Login | admin@whitebeard.dev |
| Senha | Admin123! |

## Comandos úteis

```bash
# Parar serviços
scripts/setup/run-compose.sh down

# Ver estado do Docker deste projeto
scripts/setup/docker-project.sh status

# Parar daemon rootless do projeto
scripts/setup/docker-project.sh stop
```

## Telegram e webhook

Em **localhost**, o Telegram **não recebe mensagens** até a API estar acessível por **HTTPS público**.

Depois de ter domínio ou túnel:

1. Abra **Canais** na UI ou use a URL em `GET /api/v1/channels`
2. Registe o webhook: `POST /api/v1/channels/:id/telegram/register-webhook` (admin)
3. Alternativa CLI (no backend): `npm run telegram:set-webhook` com `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_URL`

## Instalação limpa

O wizard **só corre** numa instalação limpa. Se já existir `.setup-complete`, a execução é recusada.

Manutenção (cuidado): `SETUP_FORCE=1 ./setup.sh`

## Modo não interactivo (testes / CI)

```bash
SETUP_NONINTERACTIVE=1 ./setup.sh
```

Variáveis opcionais: `SETUP_LLM_API_KEY`, `SETUP_TELEGRAM_BOT_TOKEN`, `SETUP_TELEGRAM_SECRET_TOKEN`, `SETUP_ENABLE_SO_CLINIC`, `SETUP_SO_TEAM_SOURCE`.

## O que fica onde

| Path | Conteúdo |
|------|----------|
| `.docker-location` | Caminho real do estado Docker (quando o clone está em NTFS/exFAT) |
| `data/mongo/` | Base MongoDB |
| `data/redis/` | Persistência Redis |
| `data/gallery/` | Galeria de imagens |
| `.env` | Variáveis geradas (não commitar) |
| `.setup-complete` | Marca fim da instalação |

## O que o seed inclui (e o que não inclui)

O wizard **corre o seed** no passo final (após backend e frontend healthy), usando `SEED_SCRIPT=seed-demo.ts` definido no `.env` gerado. Se o wizard falhar antes desse passo (ex.: backend unhealthy), o Mongo pode ficar vazio ou parcial — verifique se existe `.setup-complete` e os logs do serviço `seed`.

**Incluído pelo `seed-demo.ts`:**

- Utilizador admin: `admin@whitebeard.dev` / `Admin123!`
- Workspaces demo (Workspace Alpha **enterprise**, sem agentes/times pré-criados)
- Templates de exemplo, ligações MCP e bases de conhecimento
- Integrações LLM (OpenRouter/OpenAI) aplicadas via `post-setup.mjs` quando configurou chaves no wizard
- Time **SO Clínica Conversacional** quando escolheu import bundled no wizard (via `POST /teams/import`)

**Não incluído pelo seed (instalação limpa):**

- Agentes e times no workspace — excepto se o wizard importou o SO bundled
- **Tool definitions de negócio** (`/tool-definitions`) — o import SO cria definitions `clinic_*` via internal actions; caso contrário ficam vazias
- Tools de catálogo operacional listadas em **Configurações → Integrações** (`web_search`, `web_fetch`, `image_generation`) aparecem quando há chave OpenRouter/OpenAI — não são registos em `/tool-definitions`
- Tools do coordenador em runtime (second-brain, specialists) — injectadas pelo backend durante execução, não aparecem na lista de definitions

**Validar instalação:** login demo → time **SO Clínica Conversacional** (se import bundled ou import manual) → Debug com `Cadastre um paciente`; o coordenador deve responder sem erro 400/401.

### "401 Missing Authentication header" na consola do time

Quase sempre a chave OpenRouter/OpenAI no `.env` ou em **Configurações → Integrações** foi colada com o prefixo da variável (ex.: `OPENROUTER_API_KEY=sk-or-...` em vez de só `sk-or-...`). Corrija o `.env`, recrie o backend (`run-compose.sh up -d --force-recreate backend`) e execute `node scripts/setup/post-setup.mjs` para regravar integrações no workspace.

## Limitações

- Primeiro `docker compose up --build` pode demorar (download de imagens base).
- Rootless Docker exige pacotes user-level (`dockerd-rootless.sh`, `rootlesskit`, `slirp4netns`).
- **Clone em NTFS/exFAT:** imagens Docker em `~/.atc-d/<hash>` (ext4, só este projeto); `data/` permanece no disco do clone.
- **Path do clone muito longo:** se o caminho absoluto do repositório exceder o limite de socket Unix do containerd (~104 chars), o estado Docker (imagens/camadas) vai para `~/.atc-d/<hash>`; `data/` permanece no clone.
- **Telegram webhook** não funciona em localhost sem túnel/domínio — wizard avisa e permite pular.
- Produção/Coolify continua a usar [`docker-compose.yaml`](docker-compose.yaml) com Atlas — **não** use `docker-compose.setup.yaml` em produção.

## Problemas comuns

### "Docker rootless não disponível"

Instale rootless Docker (link acima) e garanta `dockerd-rootless.sh` no `PATH`.

### "timeout ao iniciar dockerd-rootless" / `unix socket path too long`

O containerd rootless exige paths curtos para sockets Unix. O wizard escolhe automaticamente `~/.atc-d/<hash>` quando o clone está num path longo. Para forçar um local específico:

```bash
export TEAMAGENTS_DOCKER_STATE="$HOME/.atc-d/meu-projeto"
./setup.sh
```

### Portas 3001 / 3002 / 27017 / 6379 ocupadas

Altere no `.env` gerado: `BACKEND_PORT`, `FRONTEND_PORT`, `MONGO_PORT`, `REDIS_PORT` e URLs `NEXT_PUBLIC_*` / `CORS_ORIGIN` de forma coerente; depois `run-compose.sh up -d --build`.

### Wizard recusa executar

Já existe `.setup-complete` ou instalação parcial. Remova `.setup-complete`, `.env`, `data/` e `.docker/` **só neste clone** ou use `SETUP_FORCE=1` conscientemente.
