# Rodando localmente

Guia canônico para instalar, configurar, subir e testar o **TeamAgents / agents-team-crafter** em uma máquina nova.

> **Demo online:** [https://myteams.whitebeard.dev](https://myteams.whitebeard.dev) — mesma aplicação, ambiente de demonstração.
>
> **Primeira instalação sem experiência técnica:** use o wizard [`./setup.sh`](../setup.sh) e o [Guia rápido em setup-wizard.md](./setup-wizard.md#guia-rápido--primeira-instalação-para-testar) (Docker Compose com Mongo local; dados da app em `data/`; macOS com Docker Desktop ou Linux com rootless).

> Objetivo: um engenheiro que acabou de clonar o repositório deve conseguir rodar backend, frontend, seed, IA e geração de imagens sem depender de conhecimento prévio.

## Visão rápida

O repositório é um monorepo com:

- `backend/`: BFF/API Fastify.
- `v0-team-ai-crafter/`: frontend Next.js.
- `docker-compose.yaml`: Redis, backend, frontend e seed (produção/dev com Atlas).
- `docker-compose.setup.yaml`: wizard `./setup.sh` com Mongo local.
- `docs/rodando-localmente.md`: este guia.

Arquivos de ambiente usados no desenvolvimento local:

- `.env` na raiz: usado pelo Docker Compose e pelo seed em container.
- `backend/.env`: usado pelo BFF Fastify e pelo seed local.
- `v0-team-ai-crafter/.env.local`: usado pelo Next.js.

Portas padrão (dev manual com `npm run dev`):

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- API: `http://localhost:3001/api/v1`
- Redis local: `redis://localhost:6379`
- Mongo local: `mongodb://127.0.0.1:27017/teamagents`

> **Wizard (`./setup.sh`):** o frontend fica em `http://localhost:3002`. Ver [getting-started.md](./getting-started.md) e [setup-wizard.md](./setup-wizard.md).

## 1) Pré-requisitos

Instale antes de começar:

- Node.js compatível com `v0-team-ai-crafter/package.json`:
  - `>=20.19.0 <22.0.0-0`, ou
  - `>=22.13.0 <23.0.0-0`, ou
  - `>=24.0.0`.
- npm.
- Docker e Docker Compose, recomendado para MongoDB/Redis locais.
- MongoDB acessível pela aplicação, local ou Atlas.
- Redis, opcional mas recomendado para fluxos com Chat SDK.
- Uma chave de IA se quiser usar planner, runtime de agentes ou geração de imagens:
  - OpenAI: `OPENAI_API_KEY`
  - OpenRouter: `OPENROUTER_API_KEY`
- Tokens dos canais que for testar, por exemplo Slack, Telegram ou GitHub.

## 2) MongoDB rápido para desenvolvimento

O `docker-compose.yaml` do projeto sobe Redis, backend, frontend e seed, mas **não** sobe MongoDB. Você precisa usar Atlas ou subir um Mongo local. Para Mongo local integrado, use o wizard `./setup.sh` (`docker-compose.setup.yaml`).

Opção local simples:

```bash
docker run --name teamagents-mongo \
  -p 27017:27017 \
  -v teamagents_mongo_data:/data/db \
  -d mongo:7
```

Use esta URI no backend:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/teamagents
```

Se usar Atlas, troque pelo connection string do cluster e garanta que o IP da máquina esteja liberado em **Network Access**.

## 3) Instalar dependências

Não há `package.json` na raiz. Instale backend e frontend separadamente.

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd ../v0-team-ai-crafter
npm install
```

## 4) Configurar o backend

Crie o arquivo:

```bash
cd backend
cp .env.example .env
```

Configuração mínima para desenvolvimento local:

```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/teamagents
JWT_SECRET=<gere-um-valor-longo-aleatorio>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
```

Para gerar um `JWT_SECRET` local:

```bash
openssl rand -hex 32
```

Variáveis importantes do backend:

- `MONGODB_URI`: obrigatória para persistência.
- `JWT_SECRET`: obrigatória para autenticação.
- `CORS_ORIGIN`: deve incluir a origem exata usada pelo navegador.
- `REDIS_URL`: opcional/recomendado para Chat SDK.
- `PLATFORM_ADMIN_EMAILS`: opcional, define admins globais por email.
- `ENCRYPTION_MASTER_KEY`: obrigatória em produção e recomendada quando for salvar segredos de integrações.

Para gerar `ENCRYPTION_MASTER_KEY`:

```bash
openssl rand -hex 32
```

Exemplo com Redis local:

```env
REDIS_URL=redis://localhost:6379
```

## 5) Configurar IA e modelos

A aplicação pode usar OpenAI ou OpenRouter. Em ambiente multi-tenant, as credenciais podem ser configuradas por workspace na UI em **Settings > Integrations**. Para desenvolvimento/demo, também é possível usar variáveis globais no `backend/.env`.

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=<sua-chave-openai>
OPENAI_TEAM_PLAN_MODEL=gpt-5.4
OPENAI_AGENTS_RUNTIME_MODEL=gpt-5.4-mini
```

Modelo de imagem OpenAI, configurado no workspace/UI:

```text
imageGenerationModel=dall-e-3
```

Também é aceito:

```text
imageGenerationModel=dall-e-2
```

### OpenRouter

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=<sua-chave-openrouter>
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=TeamAgents Local
OPENROUTER_ATTRIBUTION_APP=teamagents-local
OPENROUTER_MAX_OUTPUT_TOKENS=4096
```

Modelos de runtime/planner podem ser definidos por workspace em **Settings > Integrations**.

Modelo de imagem OpenRouter, configurado no workspace/UI:

```text
openrouterImageGenerationModel=openai/gpt-image-1
```

Você pode trocar por outro modelo de imagem suportado pelo OpenRouter. O ponto importante é: **a geração de imagem exige token válido do provider efetivo e um modelo compatível com imagem**.

## 6) Configurar galeria de imagens

A ferramenta `image_generation` salva/expõe imagens pela galeria do backend.

No `backend/.env`:

```env
MEDIA_GALLERY_ROOT=data/gallery
PUBLIC_API_BASE_URL=http://localhost:3001
```

Notas:

- `MEDIA_GALLERY_ROOT` define onde os arquivos serão gravados no disco.
- `PUBLIC_API_BASE_URL` é usado para montar links públicos retornados pela ferramenta.
- Se mudar o host/porta do backend, atualize essa variável.

## 7) Configurar o frontend

Crie o arquivo:

```bash
cd v0-team-ai-crafter
cp .env.example .env.local
```

Configuração mínima:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=false
```

Atenção:

- `NEXT_PUBLIC_API_URL` precisa apontar para o backend com `/api/v1`.
- Se abrir o frontend por `http://127.0.0.1:3000`, inclua essa origem em `CORS_ORIGIN` no backend.
- Depois de alterar `NEXT_PUBLIC_*`, reinicie o frontend.

## 8) Subir Redis

Se for rodar Redis local via Docker:

```bash
docker run --name teamagents-redis -p 6379:6379 -d redis:7
```

Então use no `backend/.env`:

```env
REDIS_URL=redis://localhost:6379
```

## 9) Rodar o seed

Com Mongo acessível e `backend/.env` configurado:

```bash
cd backend
npm run seed
```

Após o seed, use o usuário admin criado pelo projeto para entrar no frontend. A senha demo não deve ser documentada em claro; use o valor definido pelo seed/ambiente da sua instalação.

## 10) Subir backend e frontend em modo dev

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd v0-team-ai-crafter
npm run dev
```

Abra:

```text
http://localhost:3000
```

## 11) Alternativa com Docker Compose

Crie `.env` na raiz a partir do exemplo:

```bash
cp .env.example .env
```

Configure pelo menos:

```env
MONGODB_URI=mongodb://host.docker.internal:27017/teamagents
JWT_SECRET=<gere-um-valor-longo-aleatorio>
CORS_ORIGIN=http://localhost:3002,http://127.0.0.1:3002
PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ALLOW_LOCALHOST_API=true
```

Suba os serviços:

```bash
docker compose up --build redis backend frontend
```

Rode o seed em container:

```bash
docker compose --profile seed run --rm seed
```

Notas:

- O Compose não sobe MongoDB.
- Em Docker Desktop, `host.docker.internal` costuma apontar para o host.
- Em Linux puro, talvez seja melhor usar Atlas ou ajustar a rede Docker.
- O frontend no Compose pode usar porta de host `3002`.
- Após alterar `NEXT_PUBLIC_*`, faça rebuild do frontend.

## 12) Tokens por integração

Configure apenas os tokens dos canais que for testar.

Slack:

```env
SLACK_SIGNING_SECRET=<slack-signing-secret>
SLACK_BOT_TOKEN=<slack-bot-token>
```

Telegram:

```env
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_SECRET_TOKEN=<telegram-secret-token>
TELEGRAM_WEBHOOK_URL=https://example.com/webhook
```

GitHub:

```env
GITHUB_TOKEN=<github-token>
# ou
GH_TOKEN=<github-token>
```

## 13) Teste funcional mínimo

Depois que backend, frontend e seed estiverem ok:

1. Abra `http://localhost:3000`.
2. Faça login com o usuário admin criado pelo seed.
3. Abra o dashboard e confirme que a tela carrega sem erro.
4. Vá em **Settings > Integrations**.
5. Configure OpenAI ou OpenRouter.
6. Configure o modelo de imagem:
   - OpenAI: `dall-e-3` ou `dall-e-2`.
   - OpenRouter: `openai/gpt-image-1` ou outro modelo de imagem suportado.
7. Crie ou abra um time/agente com a ferramenta `image_generation` habilitada.
8. Execute um pedido simples, por exemplo: `gere uma imagem quadrada de um robô trabalhando em um escritório`.
9. Verifique se a resposta contém a imagem ou um link de galeria/API.
10. Se a imagem não aparecer, confira token do provider, modelo de imagem, `MEDIA_GALLERY_ROOT` e `PUBLIC_API_BASE_URL`.

## 14) Testes automatizados opcionais

Com backend (`:3001`) e frontend (`:3000`) no ar:

```bash
cd v0-team-ai-crafter
npm run test:e2e:install
E2E_API_URL=http://127.0.0.1:3001/api/v1 \
E2E_USER_EMAIL=admin@whitebeard.dev \
E2E_USER_PASSWORD=<senha-local> \
E2E_BASE_URL=http://127.0.0.1:3000 \
npm run test:e2e
```

Use `127.0.0.1` ou `localhost` de forma consistente entre `E2E_*`, `NEXT_PUBLIC_*` e `CORS_ORIGIN`.

## 15) Checklist de validação

Antes de considerar o ambiente pronto:

- [ ] `backend/.env` existe e tem `MONGODB_URI`, `JWT_SECRET` e `CORS_ORIGIN`.
- [ ] `v0-team-ai-crafter/.env.local` existe e aponta para o BFF certo.
- [ ] MongoDB está acessível.
- [ ] Redis está acessível, se `REDIS_URL` estiver configurado.
- [ ] `npm run seed` rodou sem erro.
- [ ] Backend sobe sem erro.
- [ ] Frontend sobe sem erro.
- [ ] Login com o usuário admin do seed funciona.
- [ ] Dashboard carrega.
- [ ] Settings > Integrations mostra/salva o provider de IA.
- [ ] Runtime encontra `OPENAI_API_KEY` ou `OPENROUTER_API_KEY`, conforme o provider.
- [ ] Tool `image_generation` gera imagem com o modelo configurado.
- [ ] Galeria funciona quando `MEDIA_GALLERY_ROOT` e `PUBLIC_API_BASE_URL` estão configurados.

## 16) Erros comuns

### CORS no browser

Sintoma: chamadas para o BFF falham no console do navegador.

Correção:

- Confira se `CORS_ORIGIN` inclui exatamente a origem usada no navegador.
- `localhost` e `127.0.0.1` são origens diferentes.
- Reinicie o backend depois de alterar `backend/.env`.

### Frontend aponta para API errada

Sintoma: frontend carrega, mas não consegue autenticar ou buscar dados.

Correção:

- Confira `NEXT_PUBLIC_API_URL`.
- A URL deve terminar com `/api/v1`.
- Reinicie o frontend depois de alterar `.env.local`.

### Seed não conecta no banco

Sintoma: `npm run seed` falha com erro de conexão MongoDB.

Correção:

- Confira `MONGODB_URI`.
- Se usar Atlas, libere o IP da máquina.
- Se usar Mongo local, confirme que o container está rodando.

### Imagem não gera

Sintoma: tool `image_generation` falha ou retorna erro do provider.

Correção:

- Confira se o provider efetivo é OpenAI ou OpenRouter.
- Confira se há token válido no workspace ou no `backend/.env`.
- Confira se o modelo configurado suporta imagem.
- Confira `MEDIA_GALLERY_ROOT` e permissões de escrita.
- Confira `PUBLIC_API_BASE_URL` para links retornados pela galeria.

## 17) Resumo das variáveis

### Obrigatórias para local básico

- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`

### IA

- `LLM_PROVIDER`
- `OPENAI_API_KEY` ou `OPENROUTER_API_KEY`
- `OPENAI_TEAM_PLAN_MODEL`
- `OPENAI_AGENTS_RUNTIME_MODEL`
- `OPENROUTER_HTTP_REFERER`
- `OPENROUTER_APP_TITLE`
- `OPENROUTER_ATTRIBUTION_APP`
- `OPENROUTER_MAX_OUTPUT_TOKENS`

### Imagens

- `imageGenerationModel` no workspace, se OpenAI.
- `openrouterImageGenerationModel` no workspace, se OpenRouter.
- `MEDIA_GALLERY_ROOT`
- `PUBLIC_API_BASE_URL`

### Canais

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_SECRET_TOKEN`
- `TELEGRAM_WEBHOOK_URL`
- `GITHUB_TOKEN` ou `GH_TOKEN`
