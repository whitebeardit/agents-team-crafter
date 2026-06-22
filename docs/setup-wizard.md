# Wizard de instalação (primeira vez)

Guia para instalar o **TeamAgents / agents-team-crafter** numa máquina nova, sem conhecimento técnico avançado.

O wizard usa **Docker Compose** com **MongoDB local**, **Redis**, backend e frontend. Dados da aplicação (`data/`) ficam no clone; o daemon Docker rootless é **isolado por projeto** e não altera o Docker system-wide.

Instância pública de referência: **[https://myteams.whitebeard.dev](https://myteams.whitebeard.dev)** — explore a plataforma online antes ou depois de instalar localmente.

No arranque, o assistente exibe o **logo ASCII Whitebeard** no terminal (arte completa com ≥ 84 colunas; versão compacta entre 60–83). Para desactivar a arte: `SETUP_NO_BANNER=1`. Respeita `NO_COLOR` nas linhas de subtítulo.

## Índice

- [Guia rápido — primeira instalação para testar](#guia-rápido--primeira-instalação-para-testar)
- [Site demo vs instalação local](#site-demo-vs-instalação-local)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [SO · Clínica Gold (time demo)](#so--clínica-gold-time-demo)
- [Depois da instalação](#depois-da-instalação)
- [Comandos úteis](#comandos-úteis)
- [Telegram e webhook](#telegram-e-webhook)
- [Reinstalar / testar de novo](#reinstalar--testar-de-novo)
- [Modo não interactivo (testes / CI)](#modo-não-interactivo-testes--ci)
- [O que fica onde](#o-que-fica-onde)
- [O que o seed inclui (e o que não inclui)](#o-que-o-seed-inclui-e-o-que-não-inclui)
- [Limitações](#limitações)
- [Problemas comuns](#problemas-comuns)

## Guia rápido — primeira instalação para testar

Percurso mínimo para validar a plataforma no seu clone, do zero ao primeiro prompt no Debug.

**0. (Opcional) Explorar o demo online**

Abra **[https://myteams.whitebeard.dev](https://myteams.whitebeard.dev)** — mesma aplicação, dados de demonstração, sem instalar nada. Útil para ver times, agentes e internal actions antes de correr o wizard.

**Dúvidas durante a instalação?** Pergunte à IA no [DeepWiki](https://deepwiki.com/whitebeardit/agents-team-crafter) ou consulte [getting-started.md](./getting-started.md).

**1. Clone e execute o wizard**

```bash
git clone <url-do-repositorio> /media/whitebeard/OS/DEV/agents-team-crafter
cd /media/whitebeard/OS/DEV/agents-team-crafter
./setup.sh
```

**2. Escolhas recomendadas para teste rápido**

| Pergunta do wizard | Resposta recomendada |
|--------------------|----------------------|
| Configurar IA? | **Sim** — OpenRouter (recomendado) ou OpenAI, com chave válida |
| Importar time SO? | **Sim** — opção **«JSON incluído no assistente»** (bundled; offline e mais rápido) |
| Slack / GitHub | **Não** |
| Telegram | **Não** (pode configurar depois; em localhost o webhook não funciona sem HTTPS público) |

Cole **apenas o valor** da chave API (ex.: `sk-or-v1-...`), **sem** `OPENROUTER_API_KEY=`.

**3. Aguardar conclusão**

Na primeira vez, `docker compose up --build` pode demorar (download de imagens). O wizard só termina quando backend, frontend, seed e pós-setup estiverem OK.

**4. Entrar na instalação local**

| Item | Valor |
|------|--------|
| App | http://localhost:3002 |
| Login | admin@whitebeard.dev |
| Senha | Admin123! |

**5. Validar**

1. Abra o time **SO Clínica Conversacional**
2. Aba **Debug**
3. Envie: `Cadastre um paciente`
4. O coordenador deve responder sem erro 400/401

**Alternativa (export do demo):** se escolheu **«Exportar do site demo»** no passo 2, siga o guia impresso no terminal após o wizard:

1. [Time SO no demo](https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34) → «Exportar JSON»
2. Na instalação local: **Times → Importar JSON**
3. Valide no Debug (passo 5 acima)

**O que esperar**

- Após o seed, o workspace **enterprise** existe mas **sem agentes/times** até o import SO.
- **Bundled:** import automático via API; URL do time aparece no final do wizard.
- **Demo-manual:** guia passo a passo no terminal; compare com [myteams.whitebeard.dev](https://myteams.whitebeard.dev) se precisar de referência visual.

## Site demo vs instalação local

| | Demo online | Instalação local (wizard) |
|---|-------------|---------------------------|
| URL | [https://myteams.whitebeard.dev](https://myteams.whitebeard.dev) | http://localhost:3002 |
| Propósito | Explorar UI, times e fluxos sem instalar | Desenvolver, testar alterações, dados só no seu clone |
| Dados | Partilhados (ambiente demo) | `data/` e `.docker/` no repositório clonado |
| Time SO | [SO Clínica Conversacional no demo](https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34) | Import bundled ou JSON exportado do demo |
| Partilha de times | Exportar JSON na UI | Importar/exportar JSON entre workspaces ou instalações |

Use o **demo** para ver o produto em acção; use o **wizard** para ter a stack completa sob o seu controlo e validar o fluxo de instalação.

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

Para o percurso orientado a testes, siga o [Guia rápido](#guia-rápido--primeira-instalação-para-testar).

O assistente pergunta:

- Se quer configurar **IA** (OpenRouter ou OpenAI) — opcional, mas **necessário** para planner e agentes
- Se quer instalar o time demo **SO Clínica Conversacional** (7 agentes, internal actions) — **recomendado** para ver a plataforma com tools reais
  - **Exportar do [site demo](https://myteams.whitebeard.dev)** e importar na UI local, ou
  - **Importar do JSON incluído** no assistente (offline / mais rápido)
  - Depois pode criar o seu time e partilhá-lo via Exportar/Importar JSON entre workspaces ou instalações
- **Slack** e **GitHub** — opcionais
- **Telegram** — **recomendado**, mas pode **pular**

Secrets base (`JWT`, `ENCRYPTION_MASTER_KEY`) são gerados automaticamente.

**Chave de IA:** cole **apenas o valor** (ex.: `sk-or-v1-...`), **sem** `OPENROUTER_API_KEY=` ou `OPENAI_API_KEY=`. O wizard valida a chave com o provider antes de concluir; se colar a linha completa do `.env`, a autenticação falha com `401 Missing Authentication header` na consola do time.

## SO · Clínica Gold (time demo)

Referência online:

- **Site demo:** [https://myteams.whitebeard.dev](https://myteams.whitebeard.dev)
- **Time SO canónico:** [SO Clínica Conversacional](https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34)

Recomendamos importar um **time de demonstração com 7 agentes** (coordenadora + especialistas) para ver a plataforma em acção — ver passos **2** e **5** do [Guia rápido](#guia-rápido--primeira-instalação-para-testar). O time inclui **internal actions** (`clinic_*`) que demonstram orquestração, contexto clínico e delegação entre especialistas (ex.: cadastro de paciente, agenda, CRM clínico).

Depois pode **criar o seu próprio time** na UI, **exportar JSON** (detalhe do time → «Exportar JSON») e **importar** noutro workspace, noutra instalação local ou comparar com o demo.

| Opção no wizard | Manifest | Pós-setup |
|-----------------|----------|-----------|
| Exportar do [time SO no demo](https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34) e importar na UI | `soTeamSource: demo-manual` | Guia passo a passo no terminal (sem auto-import) |
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
| Demo online (referência) | https://myteams.whitebeard.dev |

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

## Reinstalar / testar de novo

| Cenário | Comando / acção |
|---------|-----------------|
| **Primeira instalação** | Clone limpo, **sem** `.setup-complete` → `./setup.sh` |
| **Repetir wizard no mesmo clone** | `SETUP_FORCE=1 ./setup.sh` — **sobrescreve** `.env`, manifest e pode reimportar SO; use com consciência |
| **Reset total neste clone** | Remover `.setup-complete`, `.env`, `data/` e `.docker/` (ou symlink `.docker`) → `./setup.sh` de novo |

O wizard **recusa executar** se já existir `.setup-complete`, excepto com `SETUP_FORCE=1`.

## Modo não interactivo (testes / CI)

Equivalente ao [Guia rápido](#guia-rápido--primeira-instalação-para-testar) sem prompts — útil em pipelines ou clones de teste automatizados. O site demo ([myteams.whitebeard.dev](https://myteams.whitebeard.dev)) não é necessário neste modo.

**Exemplo — instalação completa com SO bundled:**

```bash
SETUP_NONINTERACTIVE=1 \
  SETUP_LLM_API_KEY=sk-or-v1-... \
  SETUP_ENABLE_SO_CLINIC=1 \
  SETUP_SO_TEAM_SOURCE=bundled \
  ./setup.sh
```

**Mínimo (sem chave IA, sem SO):**

```bash
SETUP_NONINTERACTIVE=1 \
  SETUP_ENABLE_SO_CLINIC=0 \
  ./setup.sh
```

Variáveis opcionais adicionais: `SETUP_TELEGRAM_BOT_TOKEN`, `SETUP_TELEGRAM_SECRET_TOKEN`, `SETUP_SKIP_LLM_VERIFY=1`, `SETUP_NO_BANNER=1`, `SETUP_FORCE=1`.

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

Já existe `.setup-complete` ou instalação parcial. Ver [Reinstalar / testar de novo](#reinstalar--testar-de-novo).
