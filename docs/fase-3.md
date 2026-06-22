> **Documentação legada** — Bootstrap histórico; não reflecte o produto actual. Use [docs/README.md](./README.md) e [getting-started.md](./getting-started.md).

# Fase 3 — Workspaces e membros

## Rotas
- `GET /api/v1/workspaces` — lista workspaces do usuário autenticado.
- `GET /api/v1/workspaces/:id` — detalhe se membro.
- `PUT /api/v1/workspaces/:id` — atualização (apenas `owner` ou `admin`).
- `GET /api/v1/workspaces/:id/members` — lista membros com papel.
- `POST /api/v1/workspaces/:id/members/invite` — convite persistido em coleção `invites` (sem envio de e-mail).

## Implementação
- Handlers em `src/modules/workspaces/interfaces/workspace.routes.ts`.
- Repositórios: `WorkspaceRepository`, `MemberRepository`, `InviteRepository`.
