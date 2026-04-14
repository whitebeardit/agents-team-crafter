# Atualização oficial do ledger — Loop 120 CRM GOLD

## Status desta atualização

Este documento passa a ser o **suplemento canônico** do ledger `agents-team-crafter-plano-evolucao_IMPLEMENTADO.md` para registrar a mudança oficial de foco **após o Loop 119**.

Ele não invalida o histórico já fechado.

Ele apenas corrige, de forma explícita, a parte do ledger que ainda apontava como próximo foco principal algo diferente de **CRM GOLD**.

---

## O que continua válido no ledger principal

Continuam válidos e fechados:

- os Loops históricos anteriores
- os Loops 107–119 já documentados como fechados
- todo o histórico técnico já consolidado até o **Loop 119**

Em especial, permanece como último slice fechado:

- **Loop 119 — cursor versionado com validação temporal (replay-safe)**

---

## O que esta atualização substitui no ledger principal

Esta atualização substitui qualquer trecho do ledger principal que ainda diga que o próximo foco oficial é:

- `Loops 96+ por vertical de pack` como formulação aberta e genérica;
- `Loop 95` como principal prioridade corrente;
- ou o antigo `Loop 120` técnico ligado a cursor/filtros destrutivos.

Esses itens podem continuar a existir como backlog ou histórico de candidatura, mas **não** são mais a orientação oficial de curto prazo.

---

## Novo estado oficial do ledger

### Último slice oficial fechado

- **Loop 119 — cursor versionado com validação temporal (replay-safe)**

### Próximo slice oficial em aberto

- **Loop 120 — Produto GOLD: CRM perfeito primeiro, depois verticalização GOLD das demais verticais**

Documento detalhado do loop aberto:

- [`ralph-loop-120-produto-gold-crm-e-verticalizacao.md`](./ralph-loop-120-produto-gold-crm-e-verticalizacao.md)

Suplemento do plano mestre que formaliza a repriorização:

- [`agents-team-crafter-plano-evolucao_LOOP-120-ATUALIZACAO-OFICIAL.md`](./agents-team-crafter-plano-evolucao_LOOP-120-ATUALIZACAO-OFICIAL.md)

---

## Loop 120 (oficial, em aberto) — CRM GOLD

### Objetivo do slice

Transformar o CRM na primeira **vertical GOLD** do produto, com qualidade suficiente para servir de padrão oficial para as demais verticais.

### Critério de produto

O CRM só poderá ser considerado fechado quando entregar, de forma coerente:

- conversa fluida
- CRUD real e utilizável
- boundary/runtime previsível
- API/BFF coerente
- UI de produto utilizável
- templates e validação
- testes GOLD
- readiness e troubleshooting mínimos

### Slices oficiais do Loop 120

- **120.1 — Gap map oficial: CRM atual vs CRM GOLD**
- **120.2 — CRM conversacional dourado**
- **120.3 — CRM runtime / boundary GOLD**
- **120.4 — CRM HTTP / BFF GOLD**
- **120.5 — CRM UI GOLD**
- **120.6 — Templates, prompts e validação do CRM**
- **120.7 — Testes GOLD do CRM**
- **120.8 — Readiness / troubleshooting / observabilidade do CRM**
- **120.9 — Gate oficial de aceite do CRM GOLD**

### Checklist oficial do Loop 120 (aberto)

- [ ] Mapear claramente o gap entre CRM atual e CRM GOLD.
- [ ] Eliminar loops conversacionais desnecessários no CRUD de CRM.
- [ ] Fechar o boundary do CRM com contrato e semântica previsíveis.
- [ ] Garantir surface HTTP/BFF coerente para listagem, detalhe, criação, edição e desativação/remoção.
- [ ] Entregar UI de CRM realmente utilizável.
- [ ] Publicar templates/golden prompts/validation steps do CRM.
- [ ] Cobrir CRM com testes unitários, integração e smoke/E2E conforme aplicável.
- [ ] Fechar o mínimo operacional de readiness e troubleshooting da vertical.
- [ ] Marcar o loop como fechado apenas quando o CRM estiver demonstrável como vertical GOLD.

---

## Sequência oficial após o Loop 120

Após o CRM GOLD, a sequência oficial passa a ser:

- **Loop 121 — Scheduling GOLD**
- **Loop 122 — Finance GOLD**
- **Loop 123 — Clinical GOLD**
- **Loop 124 — Services & Sales GOLD**
- **Loop 125 — Packages & Encounters GOLD**
- **Loop 126 — Care GOLD**
- **Loop 127 — Reminders GOLD**
- **Loop 128 — GitHub Ops GOLD**
- **Loop 129 — Platform/Admin GOLD**

---

## Regra de encerramento daqui para frente

A partir deste ponto, o ledger deve considerar a seguinte régua para fechamento de verticais:

- não basta schema + action + teste unitário;
- vertical fechada precisa parecer **produto**;
- o fechamento deve registrar explicitamente conversa, runtime, API, UI, validação e testes.

---

## Resumo executivo final

O ledger oficial passa a considerar que:

- até o **Loop 119** a frente técnica está consolidada;
- o **próximo loop oficial em aberto** é o **Loop 120 CRM GOLD**;
- o produto agora entra numa fase de **verticalização GOLD**;
- o CRM é a referência inicial;
- as demais verticais seguem na sequência **121–129** com o mesmo nível de exigência.
