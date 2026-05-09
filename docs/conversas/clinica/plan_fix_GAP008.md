# Plano — GAP008 (nome de tool `specialist_*` com sufixo `.json`)

## Problema

Em produção (Debug Console), ao delegar para o Especialista Pacotes, o modelo por vezes emite uma chamada de função com nome `specialist_<agentId>.json`. O OpenAI Agents SDK faz correspondência **exacta** com as tools registadas; só existia `specialist_<agentId>`, pelo que o Runner falhava com mensagem do tipo:

`Tool specialist_<id>.json not found in agent Coordinator:<coordId>.`

## Abordagem

1. Registar **alias** com sufixo `.json` para cada especialista no `SpecialistRegistry.buildOpenAiTools`, com o mesmo `execute` e descrição que o nome canónico (respeitando o limite de 64 caracteres).
2. Manter `normalizeSpecialistToolName` / `resolveSpecialistAgentIdFromToolName` — já removem o sufixo `.json` para telemetria e mapeamento interno.

## Ficheiros

- [`backend/src/modules/team-runtime/infra/registries/specialist-registry.ts`](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts)
- Testes: [`specialist-registry.tool-name.test.ts`](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.tool-name.test.ts)

## Verificação

- `npx jest src/modules/team-runtime/infra/registries/specialist-registry.tool-name.test.ts`
- `npx jest src/__tests__/clinic-conversational-flow.integration.test.ts`

## Reteste manual

Após deploy: mesmo roteiro em [`exemplo_de_uso.md`](./exemplo_de_uso.md), turno «Venda de pacote» sem erro de tool missing no coordenador.
