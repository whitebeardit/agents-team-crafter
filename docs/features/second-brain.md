# Second Brain

## O que é

O **Second Brain** é o vault de conhecimento do workspace: notas, políticas e contexto que os agentes consultam em runtime (`second_brain_recall`). Com `EMBEDDINGS_ENABLED=1`, a busca passa a ser **semântica**.

## Por que é diferencial

Aproxima documentação institucional da operação — os agentes deixam de depender só do que está no prompt.

## Como testar em 5 min

1. **Settings → Memória do time** — crie ou edite uma nota
2. Num time com Second Brain activo, Debug: `O que diz a política de cancelamento?`
3. Com embeddings: defina `EMBEDDINGS_ENABLED=1` e `OPENAI_API_KEY` no backend, reinicie, repita pergunta com palavras diferentes da nota

**Plugin Obsidian:** [obsidian-plugin/whitebeard-second-brain/README.md](../../obsidian-plugin/whitebeard-second-brain/README.md) — deep-link para a Web UI.

## Pré-requisitos

- `VAULT_ROOT` configurado no backend
- Semântico: `EMBEDDINGS_ENABLED=1` + OpenAI key
- Backfill opcional: `npm run backfill-vault-embeddings` no backend

## Limitações

- Embeddings usam OpenAI (não OpenRouter para índice)
- Plugin Obsidian é ponte de leitura/deep-link, não sync bidireccional automático

## Onde está no código

- `backend/src/modules/team-vault/`
- `backend/src/modules/team-runtime/application/second-brain-coordinator-tools.ts`
- `v0-team-ai-crafter/docs/second-brain-ux-rollout.md`
