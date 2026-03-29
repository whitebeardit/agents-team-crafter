# Fase 2 — Auth e tenant

## Objetivo
Autenticação JWT, refresh token (hash SHA-256 no usuário), e contexto multi-tenant com `X-Workspace-Id`.

## O que foi feito
- Rotas em `/api/v1/auth`: `POST /login`, `POST /logout`, `GET /me`, `POST /refresh`.
- Login: bcrypt na senha; access JWT; refresh token opaco com hash armazenado em `users.refreshTokenHash`; resposta inclui `refreshToken` para o cliente chamar `/refresh`.
- Plugins `src/app/plugins/hooks.ts`: `buildAuthenticate` (Bearer) e `buildRequireTenant` (valida membership em `workspace_members`).
- Modelos: `User`, `Workspace`, `WorkspaceMember` + repositórios em `infra/`.
- Testes de integração: `src/__tests__/auth.integration.test.ts` (mongodb-memory-server).

## Regras
- Rotas de negócio multi-tenant usam `Authorization` + `X-Workspace-Id`.
- Usuário fora do workspace → 403 `FORBIDDEN`.
