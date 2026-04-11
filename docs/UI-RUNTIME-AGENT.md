# Matriz UI do agente ↔ runtime (OpenAI Agents SDK)

**Propósito:** documentar quais campos da tela de agente são persistidos, quais entram no **prompt** e no **OpenAI Agents SDK** em `runStep` (especialista) e o que permanece apenas metadado ou política futura.

**Runtime de produção:** `POST /api/v1/teams/:id/run` → [`CoordinatorOrchestratorService`](../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts) → [`OpenAIAgentsRuntimeProvider`](../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts).

**Pipeline do coordenador:** continua descrito em [`v0-team-ai-crafter/docs/agents-and-handoff.md`](../v0-team-ai-crafter/docs/agents-and-handoff.md).

---

## Resumo por área da UI

| Área na UI | Persistência (Mongo) | Efeito no runtime atual |
|------------|----------------------|-------------------------|
| **Skills (vírgula)** | `skills: string[]` | Incluídas no texto de **instrução** do especialista (bloco “Skills tags”). |
| **Missão** (objetivo / responsabilidades) | `goal`, `responsibilities` | Concatenadas ao **system instruction** efetivo (`## Objective`, `## Responsibilities`). |
| **Instrução de sistema** (modo avançado) | `systemInstruction` | Base do prompt; missão e skills são **acrescentadas** ao mesmo campo efetivo. |
| **Conhecimento** (fontes + memórias) | `knowledge` | IDs em `sources` geram um bloco **## Knowledge sources** com nome/tipo/descrição das fontes. `fixedContext` e flags de memória viram linhas de política no prompt. **Não** há RAG/embeddings neste runtime. |
| **Ferramentas** (catálogo) | `capabilities.tools` | IDs em [`available-tools`](../backend/src/modules/agents/domain/available-tools.ts): cada um vira **function tool** do SDK. Com integração por workspace (ver abaixo), `database_query` e `calendar_access` executam Postgres read-only ou HTTP; sem integração, resposta de stub/indisponível. **CRM** de domínio não usa catálogo HTTP: use o pack `crm` / `internal_action` (`crm_*`) sobre o MongoDB. |
| **Ferramentas do workspace** | `capabilities.customToolDefinitionIds` | Definições em `WorkspaceToolDefinition`: `http_webhook`, `internal_action`, `mcp_ref`, `builtin_ref`. O builder monta tools adicionais; `internal_action` chama o [`BusinessToolRuntime`](../backend/src/modules/business-tools/application/business-tool-runtime.ts) (ações registadas no registry, persistência MongoDB nos módulos de domínio). |
| **Integrações (Settings → Integrações)** | `Workspace` secrets cifrados | `toolDatabase.postgresReadOnlyUrl` e `toolCalendar` alimentam os executores built-in das tools de catálogo acima. CRM externo, se necessário no futuro, documenta-se como `http_webhook` ou MCP — não há `toolCrm` no catálogo. |
| **MCPs vinculados** | `AgentMcpBinding` | Cada `allowedTools` vira **function tool** do SDK. Se a conexão MCP tiver `mcpHttpUrl` (e headers opcionais) no config, a invocação faz **HTTP** para esse endpoint em vez de stub. `requiresApproval` mapeia para `needsApproval` no SDK quando aplicável. |
| **Canais (tipos) + responder diretamente** | `channelConfig` / `channels` | **Roteamento Chat SDK** usa `Team.channelIds` + documento `Channel`, não estes campos. `canReplyDirectly` **não** altera o webhook inbound; ver alerta na UI. |
| **Segurança** | `security` | `accessLevel` e `requiresApproval` são incluídos como **linhas de política** no prompt do especialista. Enforcement adicional (bloqueio de tool, aprovação humana) não é aplicado automaticamente no orquestrador. |

---

## Coordenador vs especialista

- **Inbound (Slack, etc.):** sempre o **coordenador** do time cujo `channelIds` contém o canal; a resposta postada é a do coordenador.
- **Especialistas:** executados via `runStep` quando o coordenador chama a tool `specialist_*`; recebem o prompt composto acima e as tools de catálogo + MCP + workspace.

### Domínio de negócio (`internal_action`) e MongoDB

- O **coordenador** só expõe tools `specialist_*` ao modelo — **não** recebe `internal_action` diretamente ([`SpecialistRegistry`](../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts)).
- Quem persiste ou lê dados em CRM, Clinical, Finance, etc. é o **especialista**, quando o modelo invoca uma tool `internal_action` cujo `config.actionId` está registado e a definição está **ativa** e ligada ao agente em `customToolDefinitionIds`.
- Não há leitura implícita do MongoDB: o modelo precisa de **chamar** as ações de leitura/listagem expostas como `internal_action` (tool-calling). O catálogo legível de ações e descrições PT-BR é servido por `GET /api/v1/business-actions/catalog` (lista alinhada ao registry em tempo de execução).

---

## Observabilidade de tools

- Cada invocação de tool pode ser auditada em logs estruturados com `kind: tool_invocation`, `workspaceId`, `tool`, `ok`, `correlationId` (quando o pedido ao runtime o propaga).
- Código: [`tool-invocation-logger`](../backend/src/modules/runtime/application/tool-invocation-logger.ts).

---

## Limitações explícitas

- **AWS Bedrock / Agent SDK:** não há provider AWS neste repositório; motor é **OpenAI Agents SDK**.
- **JSON Schema de saída** na UI: não há campo persistido; `TeamRunSpecialistResult.structured` no tipo do cliente pode ser preenchido em evoluções futuras.
- **Código arbitrário do cliente no BFF:** não suportado; ver [`TOOL_SANDBOX.md`](./TOOL_SANDBOX.md) para opções (webhook, MCP, sandbox futura).

---

## Ver também

- [ADR-0001 — runtime e handoff](./ADR-0001-agents-runtime-handoff-deterministico.md)
- [CHAT_SDK_TEAM_TRIGGER](./CHAT_SDK_TEAM_TRIGGER.md)
- [TOOL_SANDBOX.md](./TOOL_SANDBOX.md)
