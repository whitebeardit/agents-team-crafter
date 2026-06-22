# Escritório virtual

## O que é

O **escritório virtual** mostra o time digital a trabalhar: canvas Phaser, timeline de eventos e replay. Desfaz a "caixa preta" da IA durante uma execução.

## Por que é diferencial

Operadores veem progresso, contexto e sinais visuais em tempo real — não apenas a resposta final do chat.

## Como testar em 5 min

1. Abra um time (ex.: SO Clínica)
2. Navegue para **Escritório virtual** (`/teams/[id]/office`)
3. Noutra aba ou no Debug, envie um prompt
4. Observe eventos na timeline e movimento no canvas

Com Redis (`REDIS_URL`), o live fan-out funciona entre instâncias.

## Pré-requisitos

- Execução activa no mesmo time
- Redis recomendado para SSE live em multi-instância

## Limitações

- Replay depende de execuções persistidas
- Performance do canvas varia com volume de eventos

## Onde está no código

- `v0-team-ai-crafter/lib/office/`
- `v0-team-ai-crafter/app/(app)/teams/[id]/office/`
- `backend/src/modules/teams/infrastructure/team-live-broadcaster.ts`
