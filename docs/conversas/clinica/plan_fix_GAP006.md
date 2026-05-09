# Plano de correção — GAP006 (mensagem pouco acionável em falha)

## Objetivo

Quando um especialista falha, o utilizador final deve receber um próximo passo claro (ex.: «vamos tentar de novo só a venda do pacote») em vez de mensagem genérica.

## Estado

**Parcialmente mitigado** ao remover a causa principal (GAP005). Melhoria adicional:

## Próximos passos (código)

- [`backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts`](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts): mapear erros técnicos (`Tool … not found`) para texto seguro + sugestão de retry canal debug.
- Opcional: flag «retry última delegação só ao Pacotes».

## Critério de aceitação

- Falhas internas não expõem nomes de tools `ws_ba_*` ao utilizador.
- Menu final inclui opção numerada «Repetir último passo» quando aplicável.
