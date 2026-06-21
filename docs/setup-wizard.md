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
- **Slack** e **GitHub** — opcionais
- **Telegram** — **recomendado**, mas pode **pular**

Secrets base (`JWT`, `ENCRYPTION_MASTER_KEY`) são gerados automaticamente.

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

Variáveis opcionais: `SETUP_LLM_API_KEY`, `SETUP_TELEGRAM_BOT_TOKEN`, `SETUP_TELEGRAM_SECRET_TOKEN`.

## O que fica onde

| Path | Conteúdo |
|------|----------|
| `.docker-location` | Caminho real do estado Docker (quando o clone está em NTFS/exFAT) |
| `data/mongo/` | Base MongoDB |
| `data/redis/` | Persistência Redis |
| `data/gallery/` | Galeria de imagens |
| `.env` | Variáveis geradas (não commitar) |
| `.setup-complete` | Marca fim da instalação |

## Limitações

- Primeiro `docker compose up --build` pode demorar (download de imagens base).
- Rootless Docker exige pacotes user-level (`dockerd-rootless.sh`, `rootlesskit`, `slirp4netns`).
- **Clone em NTFS/exFAT:** imagens Docker em `~/.atc-d/<hash>` (ext4, só este projeto); `data/` permanece no disco do clone.
- **Telegram webhook** não funciona em localhost sem túnel/domínio — wizard avisa e permite pular.
- Produção/Coolify continua a usar [`docker-compose.yaml`](docker-compose.yaml) com Atlas — **não** use `docker-compose.setup.yaml` em produção.

## Problemas comuns

### "Docker rootless não disponível"

Instale rootless Docker (link acima) e garanta `dockerd-rootless.sh` no `PATH`.

### Portas 3001 / 3002 / 27017 / 6379 ocupadas

Altere no `.env` gerado: `BACKEND_PORT`, `FRONTEND_PORT`, `MONGO_PORT`, `REDIS_PORT` e URLs `NEXT_PUBLIC_*` / `CORS_ORIGIN` de forma coerente; depois `run-compose.sh up -d --build`.

### Wizard recusa executar

Já existe `.setup-complete` ou instalação parcial. Remova `.setup-complete`, `.env`, `data/` e `.docker/` **só neste clone** ou use `SETUP_FORCE=1` conscientemente.
