# Plano de produção das verticais (casos reais)

## Objetivo

Transformar o estado atual das verticais em um modelo operacional de producao real com criterio objetivo de entrada, execucao, auditoria e recertificacao.

## Escopo do programa de ondas

- Onda 1: CRM
- Onda 2: Agenda/Scheduling
- Onda 3: Atendimento
- Onda 4: Pacotes
- Onda 5: Financeiros
- Onda 6: Care
- Onda 7: Clinical
- Onda 8: Lembretes

Cada onda segue o mesmo padrao: baseline real, workflow operacional, criterio de go-live e governanca pos-go-live.

## Baseline real por vertical (programa completo)

| Vertical | Readiness/Gate base | Smoke base | Decisao atual | Principais gaps para producao |
| --- | --- | --- | --- | --- |
| CRM | `ready/attention` conforme `GET /api/v1/parties/readiness` e `GET /api/v1/parties/gold-gate` | `docs/RALPHLOOP/ralph-loop-138-slice-4-1-crm-smoke-manual.md` | `hold` | dedupe assistido, auditoria reforcada, smoke automatizado |
| Agenda/Scheduling | gate operacional de agenda + fluxos `schedule_*` ativos | `docs/RALPHLOOP/ralph-loop-139-slice-4-2-scheduling-smoke-manual.md` | `hold` | estabilidade diaria da rotina de agenda e evidencia por turno |
| Atendimento | pack de atendimento em `packages_encounters` e fluxo de sessao no runtime | `tenants/whitebeard/projects-doc/agents-team-crafter/13-validacao-operacional-fluxo-clinica-s1-s5.md` | `hold` | delimitacao do escopo de atendimento e smoke dedicado |
| Pacotes | contrato explicito da vertical de pacotes/encounters | `docs/RALPHLOOP/ralph-loop-103-vertical-packages-encounters-contrato-explicito.md` | `hold` | governanca de saldo, elegibilidade e consumo idempotente |
| Financeiros | contratos de finance + smoke financeiro principal | `docs/RALPHLOOP/ralph-loop-140-slice-4-3-finance-smoke-manual.md` | `hold` | trilha de risco para baixas e recertificacao orientada a pendencias |
| Care | normalizacao semantica e continuidade em care/reminders | `docs/RALPHLOOP/ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md` | `hold` | fronteira Care vs CRM e consistencia de vinculos |
| Clinical | gate clinico + workflows `clinic_*` e `clinical_*` ativos | `docs/RALPHLOOP/ralph-loop-141-slice-4-4-clinical-smoke-manual.md` | `hold` | clinic-first obrigatorio, contexto continuo, guardrails ampliados |
| Lembretes | fluxo de reminders em agenda/care + continuidade operacional | `docs/RALPHLOOP/ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md` | `hold` | evitar conflito de estado entre lembrete, agenda e atendimento |

Legenda de decisao:

- `go`: pode operar em producao dentro do SLA acordado.
- `hold`: funcional, mas sem robustez minima para escalar com risco controlado.
- `blocked`: bloqueio critico para operacao real.

## Workflows reais por onda (alto detalhe)

### Onda 1 - CRM (recepcao/comercial)

1. Receber pedido em linguagem natural (cadastrar/atualizar/localizar cliente).
2. Resolver identidade por telefone ou `partyId`.
3. Executar `crm_*` correspondente.
4. Retornar resultado objetivo (quem foi alterado e qual campo).
5. Se houver ambiguidade de identidade, parar fluxo e pedir desambiguacao.

### Onda 2 - Agenda/Scheduling (operacao diaria)

1. Confirmar contexto do cliente/paciente.
2. Executar o fluxo: confirmar, reagendar, no-show ou concluir.
3. Validar efeito operacional: status do compromisso + lembrete + encounter quando aplicavel.
4. Registrar evidencia do turno (resultado, operador, horario).

### Onda 3 - Atendimento (operacao de sessao)

1. Confirmar contexto de atendimento (paciente, objetivo e janela de agenda).
2. Abrir/confirmar sessao no fluxo operacional correto.
3. Registrar resultado de atendimento com vinculo rastreavel.
4. Garantir fechamento consistente (`appointment`/`encounter`) antes de concluir.
5. Se houver inconsistencia de vinculo, abrir fallback de auditoria.

### Onda 4 - Pacotes (saldo e consumo)

1. Validar elegibilidade de pacote antes de agendar ou consumir.
2. Registrar venda ou selecao de pacote com identificacao canonica.
3. Consumir unidade de forma idempotente no atendimento concluido.
4. Confirmar saldo remanescente e historico de consumo.
5. Em divergencia de saldo, bloquear baixa automatica e abrir auditoria.

### Onda 5 - Financeiros (cobranca e baixa)

1. Registrar lancamento financeiro (recebivel/pagavel) com contexto operacional.
2. Expor visibilidade de pendencias e vencimentos.
3. Executar baixa somente com confirmacao explicita quando risco alto.
4. Confirmar efeito financeiro apos baixa/conciliacao.
5. Registrar trilha de evidencia para operacao critica.

### Onda 6 - Care (sujeito de cuidado)

1. Resolver fronteira de identidade: CRM (`partyId`) vs Care (`careSubjectId`).
2. Criar/atualizar sujeito de cuidado no dominio correto.
3. Garantir consistencia de vinculo entre party e careSubject.
4. Entregar resumo de cuidado sem misturar identificadores de dominio.
5. Em ambiguidade semantica, aplicar normalizacao e validar antes de gravar.

### Onda 7 - Clinical (atendimento humano clinic-first)

1. Priorizar `clinic_*` para fluxos por telefone/contexto humano.
2. Reutilizar contexto do paciente para evitar coleta repetitiva.
3. Executar atendimento com registro de evolucao e vinculos consistentes.
4. Fechar retorno com status clinico e proxima acao.
5. Em acao de risco (cancelamento, reparo, financeiro), exigir confirmacao explicita.

### Onda 8 - Lembretes (continuidade operacional)

1. Criar lembretes no contexto da agenda/rotina de cuidado.
2. Listar lembretes por data para operacao diaria.
3. Marcar conclusao ou cancelamento sem perder rastreabilidade.
4. Sincronizar estado do lembrete com agenda/atendimento quando aplicavel.
5. Em conflito de estado, priorizar consistencia operacional e abrir correção.

### Fluxo ponta-a-ponta recomendado (regressao minima)

`CRM -> Pacotes -> Agendamento -> Atendimento -> Financeiro`

Referencia de validacao:

- `docs/RALPHLOOP/ralph-loop-138-slice-4-1-crm-smoke-manual.md`
- `docs/RALPHLOOP/ralph-loop-139-slice-4-2-scheduling-smoke-manual.md`
- `docs/RALPHLOOP/ralph-loop-140-slice-4-3-finance-smoke-manual.md`
- `docs/RALPHLOOP/ralph-loop-141-slice-4-4-clinical-smoke-manual.md`
- `docs/RALPHLOOP/ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md`
- `tenants/whitebeard/projects-doc/agents-team-crafter/13-validacao-operacional-fluxo-clinica-s1-s5.md` (vault)

## Criterio de go-live por vertical

Uma vertical so entra em `go` quando todos os itens abaixo estao OK:

1. Readiness sem bloqueio critico (`ready` ou `attention` justificavel).
2. GOLD gate completo (9/9), com evidencia e timestamp.
3. Smoke principal aprovado no mesmo ciclo.
4. Evidencia de fallback/auditoria para incidente.
5. Responsavel operacional definido para a vertical.

Condicoes de bloqueio automatico:

- qualquer `blocked` no readiness;
- item faltante no GOLD gate;
- falha de smoke critico;
- regressao recorrente sem plano corretivo com prazo.

## Checklists objetivos `hold -> go` por vertical

### CRM (`checklist_crm`)

- [ ] deduplicacao assistida ativa para contatos por telefone;
- [ ] trilha de auditoria para alteracao critica validada;
- [ ] smoke CRM aprovado no ciclo atual;
- [ ] owner CRM aprova promocao em registro formal.

### Scheduling (`checklist_scheduling`)

- [ ] rotina diaria completa (confirmar/reagendar/no-show/concluir) executada sem falha critica;
- [ ] evidencia operacional por turno registrada;
- [ ] smoke de agenda aprovado no ciclo atual;
- [ ] owner Agenda aprova promocao em registro formal.

### Atendimento (`checklist_attendance`)

- [ ] escopo de atendimento (entrada/saida) validado;
- [ ] fechamento consistente de `appointment`/`encounter` sem pendencia;
- [ ] smoke de atendimento aprovado no ciclo atual;
- [ ] owner Atendimento aprova promocao em registro formal.

### Pacotes (`checklist_packages`)

- [ ] elegibilidade e saldo validados no fluxo real;
- [ ] consumo idempotente comprovado em regressao;
- [ ] smoke de pacotes aprovado no ciclo atual;
- [ ] owner Pacotes aprova promocao em registro formal.

### Financeiros (`checklist_finance`)

- [ ] confirmacao obrigatoria de operacoes de risco ativa;
- [ ] baixa/conciliacao com evidencia rastreavel validada;
- [ ] smoke financeiro aprovado no ciclo atual;
- [ ] owner Financeiro aprova promocao em registro formal.

### Care (`checklist_care`)

- [ ] fronteira Care vs CRM validada em operacao;
- [ ] integridade `partyId`/`careSubjectId` aprovada;
- [ ] smoke de care aprovado no ciclo atual;
- [ ] owner Care aprova promocao em registro formal.

### Clinical (`checklist_clinical`)

- [ ] padrao clinic-first aplicado em atendimento humano;
- [ ] continuidade de contexto de paciente validada;
- [ ] regressao S1-S5 aprovada no ciclo atual;
- [ ] owner Clinical aprova promocao em registro formal.

### Lembretes (`checklist_reminders`)

- [ ] fluxo criar/listar/concluir/cancelar validado;
- [ ] sem conflito de estado com agenda/atendimento;
- [ ] smoke de lembretes aprovado no ciclo atual;
- [ ] owner Lembretes aprova promocao em registro formal.

### Regra incremental por onda

Uma onda so pode ser encerrada quando:

1. a vertical da onda possui baseline completo no playbook;
2. ha linha dedicada na matriz (`go|hold|blocked`);
3. existe entrada de recertificacao no log GOLD;
4. foi definido smoke principal da vertical com evidencia minima;
5. foi nomeado owner operacional da vertical.

## Governanca pos go-live

### Cadencia

- Diario: smoke reduzido das verticais em `go` e das ondas em consolidacao.
- Semanal: revisar sinais de `attention`, top incidentes e planos corretivos.
- Quinzenal ou mensal: recertificacao GOLD por criticidade da vertical.

### Triggers extraordinarios

- incidente critico de producao;
- queda abrupta de readiness;
- falha E2E recorrente da jornada principal.

### Resultado da recertificacao

- `gold_maintained`
- `gold_at_risk`
- `gold_revoked`

Todo resultado diferente de `gold_maintained` exige acao corretiva com prazo e owner.

## Backlog MVP -> producao por ondas

### Onda 1 - CRM

- **P1**: dedupe/merge assistido, auditoria critica, smoke minimo em pipeline.
- **P2**: qualidade de dados por tipo de operacao, metricas de ambiguidade.
- **P3**: saneamento proativo e plano de recuperacao em massa.

### Onda 2 - Agenda/Scheduling

- **P1**: rotina diaria estavel e evidencia por turno.
- **P2**: criterio objetivo de promocao `hold -> go`.
- **P3**: painel de confiabilidade da agenda por time.

### Onda 3 - Atendimento

- **P1**: definir fronteira operacional e saida esperada por atendimento.
- **P2**: smoke dedicado de atendimento com fechamento consistente.
- **P3**: recertificacao com foco em continuidade de sessao.

### Onda 4 - Pacotes

- **P1**: fluxo elegibilidade -> consumo idempotente.
- **P2**: auditoria de divergencia de saldo.
- **P3**: recertificacao orientada a integridade de consumo.

### Onda 5 - Financeiros

- **P1**: cobranca/baixa com confirmacao de risco.
- **P2**: indicadores de pendencia critica e atraso.
- **P3**: recertificacao financeira com trilha de risco.

### Onda 6 - Care

- **P1**: fronteira Care vs CRM explicitada em operacao.
- **P2**: consistencia de `partyId`/`careSubjectId` em todos os fluxos.
- **P3**: recertificacao de integridade relacional do dominio.

### Onda 7 - Clinical

- **P1**: clinic-first obrigatorio em atendimento humano.
- **P2**: regressao semanal S1-S5 e continuidade de contexto.
- **P3**: painel de confiabilidade clinica e recertificacao fixa.

### Onda 8 - Lembretes

- **P1**: criar/listar/concluir/cancelar com consistencia de estado.
- **P2**: integracao sem conflito com agenda/atendimento.
- **P3**: recertificacao de continuidade operacional.

## Checklist operacional de decisao rapida

Antes de anunciar uma vertical como pronta para producao:

- [ ] Readiness validado e sem `blocked`.
- [ ] GOLD gate 9/9 com evidencia.
- [ ] Smoke manual/automatizado do fluxo principal aprovado.
- [ ] Fallback e auditoria testados.
- [ ] Owner e SLA da vertical definidos.

