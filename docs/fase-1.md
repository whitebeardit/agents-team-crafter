# Fase 1 — Bootstrap da aplicação

## Objetivo
Base técnica da API BFF com Fastify, MongoDB, envelope de resposta e healthcheck.

## O que foi feito
- Pacote Node em `backend/` com TypeScript (ESM), scripts `dev`, `build`, `start`, `test`, `seed`.
- `src/config/env.ts`: variáveis validadas com Zod (`MONGODB_URI`, `JWT_SECRET` ≥32 chars, `PORT`, `CORS_ORIGIN`, expiração JWT).
- `src/app/app.ts`: Fastify + `@fastify/cors` + plugins `logger` (request id) e `error-handler` (envelope de erro + `ZodError`).
- `src/app/server.ts`: conexão Mongoose, graceful shutdown.
- `GET /health` na raiz (fora de `/api/v1`).
- `src/shared/kernel/envelope.ts`: `successEnvelope` / `errorEnvelope`.
- `src/shared/errors/app-error.ts`: erros de domínio com código HTTP.
- Compilação: `bun run build` (ou `tsc -p tsconfig.build.json`).

## Critérios de aceite
- Servidor sobe com `bun run dev` ou `node` após build.
- Mongo conecta via `MONGODB_URI`.
- `GET /health` retorna JSON com status.
- Erros retornam envelope `{ success: false, error: { code, message, details } }`.
