# Plano de correção — GAP003 (`second_brain_recall` em fluxo clínico)

## Objetivo

Reduzir latência e ruído quando o utilizador só pede operação de clínica (CRM/pacotes/agenda).

## Estado

**Aberto — decisão de produto.**

Possíveis direções:

1. Remover `second_brain_recall` (ou equivalente) da lista de tools do **coordenador** deste time em base de dados / preset de workspace.
2. Condicionar recall a intents explícitos («procura na base de conhecimento»).
3. Manter mas não expor na narrativa técnica do utilizador final (apenas UI).

## Critério de aceitação

- Mensagens operacionais puras não disparam recall numa percentagem relevante de tentativas (telemetria/execuções).

## Ficheiros candidatos

- Configuração do agente coordenador no backend/UI de agentes.
- [`team-so-clinic-psy.json`](../../teams/team-so-clinic-psy.json) `capabilities` da coordenadora (após alinhamento com produto).
