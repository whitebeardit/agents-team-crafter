# Plano de correção — GAP004 (pacotes pedem nome apesar do telefone)

## Objetivo

Quando nome **e** telefone já estão no contexto, o Especialista Pacotes deve ir directo a `clinic_sell_default_package` (ou resolver identidade por telefone), sem perguntar «confirma o nome completo».

## Alteração feita

- Actualização do `systemInstruction` do **Especialista Pacotes** em [`docs/teams/team-so-clinic-psy.json`](../../teams/team-so-clinic-psy.json) (duplicado em `agent` e `sections.system`).

## Critério de aceitação

- No Console, após cadastro com nome+telefone, o pedido «vende pacote de N sessões» não deve gerar pergunta redundante de nome.

## Reteste

1. Importar JSON actualizado para o ambiente.
2. Repetir turnos 2–3 do [`exemplo_de_uso.md`](./exemplo_de_uso.md).
