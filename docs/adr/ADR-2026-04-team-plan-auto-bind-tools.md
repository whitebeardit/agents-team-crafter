# ADR: bind automático de business tools no execute do team plan

## Contexto

O planner passou a devolver `requiredPacks` e `requiredTools` (Loop 26 fase 1). Falta **materializar** isso em `WorkspaceToolDefinition` (`internal_action`) e em `capabilities.customToolDefinitionIds` dos agentes criados.

## Decisão

- **Política por ambiente:** `TEAM_PLAN_AUTO_BIND_TOOLS` (`0` | `1`, default `0`). Só quando `1` o backend cria/reutiliza definitions e faz merge em agentes **novos** do plano (não em agentes `reused`).
- **Mapeamento de packs:** `planner-pack-presets.ts` — identificadores de pack (ex. `crm`) expandem para actionIds conhecidos do registry.
- **Slug estável:** `actionIdToToolSlug` → definitions com `kind: internal_action` e `config.actionId`, evitando duplicar por workspace.

## Consequências

- Produção segura com default `0`; ativar bind só quando o operador quiser.
- UI pode mostrar `requiredPacks` / `requiredTools` antes de executar; o bind só ocorre no servidor se a flag estiver ativa.
- **Observabilidade (Loop 29):** logs estruturados `team_plan.auto_bind_summary` / truncagem; `responseMeta` inclui `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated` no execute.
