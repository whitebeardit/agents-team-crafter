# Plano de correção — GAP002 (concordância gramatical)

## Objetivo

Evitar mensagens como «Helena foi cadastrad**o**» quando o nome é tipicamente feminino.

## Alteração feita

- Secção **Fronteiras duras** + orientação de linguagem no [`docs/teams/team-so-clinic-psy.json`](../../teams/team-so-clinic-psy.json) para o **Especialista Paciente/CRM**: preferir «Cadastro concluído» ou concordância adequada quando o género for evidente.

## Critério de aceitação

- Novo cadastro com nome feminino típico não devolve «cadastrado» no masculino de forma sistemática (validação manual no Console após import do JSON).

## Notas

Concordância perfeita para todos os nomes exigiria inferência adicional; o texto sugere neutralidade como fallback.
