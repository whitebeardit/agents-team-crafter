# Plano de correção — GAP005 (tool de pacotes invocada no agente CRM)

## Objetivo

Eliminar erro `Tool ws_ba_clinic_sell_default_package not found in agent` no Especialista Paciente/CRM quando o utilizador pede venda de pacote.

## Causa raiz

- O modelo do CRM tentou chamar `clinic_sell_default_package`, que **não** está no conjunto de tools desse agente (correcto por desenho).
- O coordenador pode ter encaminhado instruções que misturam «verificar cadastro» com «vender pacote», levando o CRM a tentar executar a venda.

## Alterações feitas

1. **Especialista Paciente/CRM** — proibição explícita de invocar tools de pacotes/agenda/financeiro; se o pedido misturar domínios, faz só CRM e devolve à Coordenadora.
2. **Coordenadora** — secção «Delegação sem cruzamento de domínio»: venda de pacote só Especialista Pacotes; ordem cadastro → pacotes sem pedir ao CRM para «concluir venda».

Ficheiro: [`docs/teams/team-so-clinic-psy.json`](../../teams/team-so-clinic-psy.json).

## Critério de aceitação

- Fluxo «cadastra Helena → vende pacote 3 sessões» completa sem erro de tool no CRM e com `clinic_sell_default_package` apenas no Especialista Pacotes (visível na narrativa técnica).

## Reteste

Console debug: repetir mensagem de venda de pacote após import do JSON.
