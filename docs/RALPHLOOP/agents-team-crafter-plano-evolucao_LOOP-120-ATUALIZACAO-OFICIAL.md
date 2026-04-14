# Atualização oficial do plano mestre — Loop 120 CRM GOLD

## Status desta atualização

Este documento passa a ser o **suplemento canônico** do plano mestre `agents-team-crafter-plano-evolucao.md` para tudo que diz respeito à prioridade oficial **após o Loop 119**.

Ele existe para registrar, sem ambiguidade, a mudança de foco do roadmap:

- sair de uma priorização centrada em hardening incremental de runtime como próximo alvo principal;
- entrar numa priorização centrada em **produto funcional GOLD por vertical**.

---

## O que esta atualização substitui no plano mestre

Esta atualização **substitui** qualquer texto anterior do plano mestre que ainda indique como próximo foco oficial:

- `Loop 120 — cursor com binding de filtros (stage/janela) para consistência forte entre páginas`
- ou qualquer formulação equivalente em que o próximo recorte principal continue sendo apenas endurecimento de cursor/auditoria destrutiva.

Esses hardenings continuam válidos como backlog técnico incremental, mas **não** são mais a prioridade oficial do produto.

---

## Nova prioridade oficial

### Último slice fechado

O último slice oficialmente fechado continua sendo:

- **Loop 119 — cursor versionado com validação temporal (replay-safe)**

### Próximo loop oficial

O próximo loop oficial passa a ser:

- **Loop 120 — Produto GOLD: CRM perfeito primeiro, depois verticalização GOLD das demais verticais**

Documento detalhado do loop:

- [`ralph-loop-120-produto-gold-crm-e-verticalizacao.md`](./ralph-loop-120-produto-gold-crm-e-verticalizacao.md)

---

## Decisão executiva oficial

A prioridade do produto passa a ser:

> **fechar uma vertical perfeita e demonstrável, com qualidade GOLD.**

A vertical escolhida para isso é:

- **CRM**

O CRM passa a ser a **vertical de referência** para a qualidade do produto.

Depois dele, as outras verticais devem ser fechadas no mesmo padrão.

---

## O que significa GOLD

A partir desta atualização, uma vertical **não** pode mais ser considerada fechada apenas porque possui:

- `actionId`
- schema
- handler
- teste unitário

Uma vertical só deve ser considerada **GOLD** quando entregar, de forma coerente:

- conversa fluida
- CRUD ou fluxo completo
- runtime/boundary previsível
- HTTP/BFF coerente
- UI de produto utilizável
- templates / validação / golden prompts
- testes de integração e regressão
- readiness / troubleshooting operacional mínimo

---

## Loop 120 — CRM GOLD

O Loop 120 fica oficialmente definido como:

- **Gap map oficial do CRM atual vs CRM GOLD**
- **Conversa dourada de CRM**
- **Runtime/boundary GOLD do CRM**
- **HTTP/BFF GOLD do CRM**
- **UI GOLD do CRM**
- **Templates / prompts / validação do CRM**
- **Testes GOLD do CRM**
- **Readiness / troubleshooting / observabilidade do CRM**
- **Gate oficial de aceite do CRM GOLD**

O detalhamento de slices está no documento:

- [`ralph-loop-120-produto-gold-crm-e-verticalizacao.md`](./ralph-loop-120-produto-gold-crm-e-verticalizacao.md)

---

## Sequência oficial após o CRM

Após o Loop 120, a sequência oficial passa a ser:

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

## Regra Ralph a partir daqui

A partir desta atualização, o padrão oficial passa a ser:

1. fechar **uma** vertical com qualidade GOLD;
2. usar essa vertical como referência de produto;
3. repetir o mesmo padrão na próxima vertical;
4. evitar considerar “feito” um domínio que ainda não esteja realmente demonstrável em produto.

---

## Relação com o backlog técnico anterior

Os itens anteriores de:

- `Loop 95 — polimento final de UI padrão e responsiva para operação`
- `Loops 96+` como placeholder genérico de verticais por pack
- ou o candidato antigo de `Loop 120` focado em cursor

passam a ser reinterpretados da seguinte forma:

- **Loop 95** permanece como backlog complementar de polimento operacional;
- **Loops 96+** deixam de ser a principal formulação corrente e passam a ser substituídos pela sequência explícita **120–129**;
- o antigo `Loop 120` técnico perde prioridade oficial para o novo **Loop 120 CRM GOLD**.

---

## Resumo executivo final

A fonte oficial de planejamento passa a considerar que:

- o runtime já amadureceu o suficiente para mudar o foco;
- o problema agora é **produto demonstrável**, não apenas mais hardening isolado;
- o CRM será a primeira vertical perfeita;
- as demais verticais serão fechadas depois no mesmo padrão GOLD.
