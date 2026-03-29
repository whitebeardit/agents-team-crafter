# Multi-tenant (requisito de produto)

O produto **é multi-tenant**: cada organização opera num **workspace** isolado na mesma instância da API e da base de dados.

## Princípios

1. **Isolamento de dados** — Agente, time, canal, fonte de conhecimento, MCP, etc. estão sempre associados a um `workspaceId`. Repositórios e serviços filtram por esse id; não aceder a dados de outro workspace só com `userId` sem validar **membro** desse workspace.

2. **Contexto HTTP** — Pedidos autenticados usam `Authorization: Bearer <jwt>` e **`X-Workspace-Id`** (ou equivalente) para o tenant ativo. Sem membro válido → `403`.

3. **Segredos por workspace** — Credenciais de integrações (OpenAI/BYOK, SMTP, Slack ao nível do workspace, etc.) são **persistidas cifradas** (AES-256-GCM com `ENCRYPTION_MASTER_KEY` no servidor). **Não** são variáveis de ambiente partilhadas entre tenants em produção.

4. **Segredos só de instância no `.env`** — `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, URLs públicas, Redis opcional. `OPENAI_API_KEY` e `SLACK_*` no ambiente são **apenas fallback para desenvolvimento/demo local**, documentados em `backend/.env.example`.

5. **Configuração na aplicação** — Administradores configuram integrações na **UI** (Settings do workspace e fluxos contextuais), não editando `.env` por tenant.

## APIs relevantes

- `GET/PUT /api/v1/settings/workspace/integrations` — estado mascarado e atualização de segredos do workspace (admin/owner).
- `PUT /api/v1/channels/:id/secrets` — segredos por **canal** Chat SDK (continua a aplicar-se por workspace via `X-Workspace-Id`).

## Testes

Incluir cenários em que um utilizador com acesso ao workspace A **não** consegue ler ou alterar recursos do workspace B (`403` / `404`). Ver `backend/src/__tests__/cross-tenant.integration.test.ts`.

## Auditoria de código (escopo)

Rotas REST usam `req.workspaceId` após `requireTenant`; repositórios de agentes, times, canais, etc. recebem `workspaceId` explícito nas queries. Novas integrações devem seguir o mesmo padrão e evitar ler credenciais globais do processo para dados de um tenant específico.
