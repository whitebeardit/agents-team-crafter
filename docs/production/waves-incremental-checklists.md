# Checklists incrementais por onda

Este arquivo operacionaliza o programa de 8 ondas, uma vertical por onda, com criterio uniforme de passagem.

## Regra de passagem de onda

Uma onda passa para a proxima quando todos os itens abaixo estao completos:

- [ ] baseline da vertical atualizado no playbook;
- [ ] linha da vertical atualizada na matriz (`go|hold|blocked`);
- [ ] entrada de recertificacao registrada no log;
- [ ] smoke principal da onda executado com evidencia;
- [ ] owner da vertical definido.

## Onda 1 - CRM

- [ ] Validar readiness/gate/smoke de CRM.
- [ ] Fechar backlog P1 (dedupe, auditoria, smoke em pipeline).
- [ ] Confirmar criterio de promocao `hold -> go`.

## Onda 2 - Agenda/Scheduling

- [ ] Padronizar rotina diaria (confirmar/reagendar/no-show/concluir).
- [ ] Consolidar evidencia operacional por turno.
- [ ] Definir limiar de estabilidade para `go`.

## Onda 3 - Atendimento

- [ ] Delimitar escopo operacional de atendimento (entrada/saida).
- [ ] Validar dependencias com Agenda/Clinical/Pacotes.
- [ ] Executar smoke principal de atendimento com fechamento consistente.

## Onda 4 - Pacotes

- [ ] Validar elegibilidade e governanca de saldo.
- [ ] Garantir consumo idempotente no atendimento.
- [ ] Executar regressao de saldo limite e consumo duplicado.

## Onda 5 - Financeiros

- [ ] Padronizar fluxo de cobranca, baixa e inadimplencia.
- [ ] Exigir confirmacao em operacoes de risco.
- [ ] Registrar recertificacao com indicadores de atraso e pendencia.

## Onda 6 - Care

- [ ] Formalizar fronteira Care vs CRM.
- [ ] Validar integridade `partyId`/`careSubjectId`.
- [ ] Executar smoke de criacao, atualizacao e consulta de cuidado.

## Onda 7 - Clinical

- [ ] Consolidar padrao clinic-first em atendimento humano.
- [ ] Endurecer continuidade de contexto de paciente.
- [ ] Revalidar S1-S5 no ciclo da onda.

## Onda 8 - Lembretes

- [ ] Definir fluxo real criar/listar/concluir/cancelar.
- [ ] Integrar lembretes com agenda e atendimento sem conflito.
- [ ] Executar smoke por data com confiabilidade operacional.

