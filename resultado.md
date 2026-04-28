# Resultado do smoke — Console MyTeams (pós-deploy / espera 8 min)

**Data:** 2026-04-28  
**Ambiente:** https://myteams.whitebeard.dev/teams/69ec3ac50094a9aef732f87b  
**Time:** `time-clinica-psicologica-v5`  
**Sessão do console:** `2516e821` (nova conversa)

## Procedimento

1. Espera de **8 minutos** antes de iniciar o teste (pedido do utilizador).
2. Fluxo completo na mesma conversa:
   - Cadastro de paciente
   - Venda de 1 sessão do pacote padrão (mesmo telefone)
   - Pedido de listagem de pacotes por telefone (cenário que antes gerava confusão com CRM / ID interno)

## Dados utilizados

| Campo | Valor |
|-------|--------|
| Paciente | Smoke Deploy 139b |
| Telefone | +55 11 96666-5544 |

## Mensagens enviadas

1. `Cadastra a paciente Smoke Deploy 139b, celular +55 11 96666-5544.`
2. `Vende 1 sessão do pacote padrão para o celular +55 11 96666-5544.`
3. `Liste os pacotes do cliente +55 11 96666-5544`

## Resultado

**PASS**

- **Cadastro:** concluído pelo Especialista em Cadastro (`specialist_69ec3ac50094a9aef732f870`), com ID de paciente e telefone confirmados na narrativa.
- **Venda:** Especialista em Pacotes (`specialist_69ec3ac50094a9aef732f876`) — saldo 1 sessão disponível.
- **Listagem de pacotes:** resposta ao utilizador com **lista explícita**:
  - Título: «Pacotes do cliente +55 11 96666-5544:»
  - Linha: «Pacote padrão — 1 sessão restante»
- **Narrativa da última execução:** `runStep` descreve listagem por `phone: +55 11 96666-5544`; conclusão do especialista: «pacote padrão — saldo: 1 sessão restante».

**Não observado** neste run (comportamento negativo anterior): pedidos de «localizar primeiro no CRM», «bloqueio interno», «telefone não serve como ID» para **listar** pacotes por número — alinhado ao fix `package_list_by_party` / prompts Loop 140 (`139b726`).

## Nota

Confirmação visual no browser (snapshot do accessibility tree); não foi exportado JSON da API.
