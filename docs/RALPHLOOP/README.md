# Ralph Loop — documentação canónica

Toda a documentação **oficial** do Ralph Loop para este repositório está nesta pasta.

| Ficheiro | Função |
| -------- | ------ |
| [`agents-team-crafter-plano-evolucao.md`](agents-team-crafter-plano-evolucao.md) | Plano mestre (roadmap, ETAPA 9, secções por loop) |
| [`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md) | Ledger — estado dos loops, gates, próximo slice |
| [`ralph-loop-86-ai-builder-unblock.md`](ralph-loop-86-ai-builder-unblock.md) | Especificação detalhada do Loop 86 (anexo; o encerramento consolida no plano + ledger) |
| [`ralph-loop-87-especialistas-operacionais.md`](ralph-loop-87-especialistas-operacionais.md) | Especificação detalhada do Loop 87 — especialistas operacionais *(slice oficial fechado; ledger [Loop 87](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md#loop-87-fechado))* |
| [`ralph-loop-96-hotfix-schema-ws-ba-crm-update-party.md`](ralph-loop-96-hotfix-schema-ws-ba-crm-update-party.md) | Hotfix do Loop 96 — correção de schema estrito em `ws_ba_crm_update_party` e teste de regressão |
| [`ralph-loop-97-garantia-schema-crm-displayname.md`](ralph-loop-97-garantia-schema-crm-displayname.md) | Loop 97 — normalização controlada para cumprir schema canónico de `crm_create_party` (`displayName`) + diagnóstico com `submittedInput` |
| [`ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md`](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md) | Loop 98 — norma transversal: contrato garantido no runtime (normalização controlada por `actionId`, validação estrita, retry seguro e observabilidade) |
| [`ralph-loop-99-vertical-scheduling-contrato-explicito.md`](ralph-loop-99-vertical-scheduling-contrato-explicito.md) | Loop 99 — vertical Scheduling/Reminders: schemas explícitos no catálogo + aliases seguros no boundary |
| [`ralph-loop-100-vertical-finance-contrato-explicito.md`](ralph-loop-100-vertical-finance-contrato-explicito.md) | Loop 100 — vertical Finance: contratos explícitos para baixas/agregados + aliases seguros no boundary |
| [`ralph-loop-101-vertical-care-normalizacao-semantica.md`](ralph-loop-101-vertical-care-normalizacao-semantica.md) | Loop 101 — vertical Care: normalização semântica determinística para `subjectKind` no boundary |
| [`ralph-loop-102-vertical-clinical-contrato-explicito.md`](ralph-loop-102-vertical-clinical-contrato-explicito.md) | Loop 102 — vertical Clinical: contratos explícitos para actions clínicas + aliases seguros no boundary |
| [`ralph-loop-103-vertical-packages-encounters-contrato-explicito.md`](ralph-loop-103-vertical-packages-encounters-contrato-explicito.md) | Loop 103 — vertical Packages/Encounters: contratos explícitos das actions de pacote/atendimento + aliases seguros |
| [`ralph-loop-104-vertical-services-sales-contrato-explicito.md`](ralph-loop-104-vertical-services-sales-contrato-explicito.md) | Loop 104 — vertical Services/Sales: contratos explícitos de catálogo/pedidos + aliases seguros |
| [`ralph-loop-105-vertical-github-ops-contrato-explicito.md`](ralph-loop-105-vertical-github-ops-contrato-explicito.md) | Loop 105 — vertical Github Ops: contratos explícitos para actions de PR/issue + aliases seguros |
| [`ralph-loop-106-clinical-deepening-schema-estruturado.md`](ralph-loop-106-clinical-deepening-schema-estruturado.md) | Loop 106 — Clinical deepening: schema estruturado de anamnese + normalização composta de notas |
| [`ralph-loop-120-1-gap-map-crm-atual-vs-gold.md`](ralph-loop-120-1-gap-map-crm-atual-vs-gold.md) | Loop 120.1 — gap map oficial do CRM atual vs CRM GOLD |
| [`ralph-loop-130-1-gap-map-produto-atual-vs-agent-first-gold.md`](ralph-loop-130-1-gap-map-produto-atual-vs-agent-first-gold.md) | Loop 130.1 — gap map oficial do produto atual vs agent-first GOLD |
| [`ralph-loop-a2-norma-oficial-vertical-page-agent-first.md`](ralph-loop-a2-norma-oficial-vertical-page-agent-first.md) | Loop A.2 — norma oficial de vertical page agent-first (padrão reutilizável das verticais) |
| [`ralph-loop-a3-norma-oficial-operation-team-page.md`](ralph-loop-a3-norma-oficial-operation-team-page.md) | Loop A.3 — norma oficial de operation team page (time da operação como centro do produto) |
| [`ralph-loop-a4-modelo-integridade-multi-dominio.md`](ralph-loop-a4-modelo-integridade-multi-dominio.md) | Loop A.4 — modelo explícito de integridade multi-domínio (entidades mestras, vínculos e deduplicação) |
| [`ralph-loop-b1-melhorar-entrevista-guiada.md`](ralph-loop-b1-melhorar-entrevista-guiada.md) | Loop B.1 — melhoria da entrevista guiada no AI Builder (uma pergunta por vez + resumo vivo) |
| [`ralph-loop-b2-detectar-tipo-negocio-automaticamente.md`](ralph-loop-b2-detectar-tipo-negocio-automaticamente.md) | Loop B.2 — detecção automática do tipo de negócio com sugestões de domínios/especialistas |
| [`ralph-loop-b3-gate-suficiencia-mais-inteligente.md`](ralph-loop-b3-gate-suficiencia-mais-inteligente.md) | Loop B.3 — gate de suficiência inteligente (bloqueio só para lacuna crítica) |
| [`ralph-loop-b4-gate-adequacao-plano-diagnostico-legivel.md`](ralph-loop-b4-gate-adequacao-plano-diagnostico-legivel.md) | Loop B.4 — gate de adequação do plano com diagnóstico legível por ação corretiva |
| [`ralph-loop-b5-regeneracao-orientada-plano.md`](ralph-loop-b5-regeneracao-orientada-plano.md) | Loop B.5 — regeneração orientada do plano com preview + revalidação |
| [`ralph-loop-c1-catalogo-templates-prioritarios.md`](ralph-loop-c1-catalogo-templates-prioritarios.md) | Loop C.1 — catálogo de templates prioritários com critérios e contrato mínimo |
| [`ralph-loop-c2-template-gold-clinica-psicologica.md`](ralph-loop-c2-template-gold-clinica-psicologica.md) | Loop C.2 — template GOLD de clínica psicológica (referência inicial) |
| [`ralph-loop-c3-template-gold-operacao-comercial.md`](ralph-loop-c3-template-gold-operacao-comercial.md) | Loop C.3 — template GOLD de operação comercial (lead → atendimento → pagamento) |
| [`ralph-loop-c4-template-gold-servicos-consultoria.md`](ralph-loop-c4-template-gold-servicos-consultoria.md) | Loop C.4 — template GOLD de serviços/consultoria (agendamento, entrega e faturamento) |
| [`ralph-loop-d1-crm-agent-first-final.md`](ralph-loop-d1-crm-agent-first-final.md) | Loop D.1 — CRM agent-first final (entrada perfeita via time recomendado) |
| [`ralph-loop-d2-scheduling-agent-first-final.md`](ralph-loop-d2-scheduling-agent-first-final.md) | Loop D.2 — Scheduling agent-first final (confirmação, reagendamento e no-show) |
| [`ralph-loop-d3-finance-vertical-page.md`](ralph-loop-d3-finance-vertical-page.md) | Loop D.3 — Finance vertical page (cobrança, inadimplência e conciliação) |
| [`ralph-loop-d4-clinical-vertical-page.md`](ralph-loop-d4-clinical-vertical-page.md) | Loop D.4 — Clinical vertical page (triagem, evolução e follow-up seguro) |
| [`ralph-loop-d5-care-reminders-services-packages.md`](ralph-loop-d5-care-reminders-services-packages.md) | Loop D.5 — Care/Reminders/Services/Packages (fecho das verticais remanescentes) |
| [`ralph-loop-e1-sistema-visual-unico-verticais.md`](ralph-loop-e1-sistema-visual-unico-verticais.md) | Loop E.1 — sistema visual único das verticais (padrão visual e responsivo comum) |
| [`ralph-loop-e2-cta-principal-unico.md`](ralph-loop-e2-cta-principal-unico.md) | Loop E.2 — CTA principal único (semântica uniforme da ação primária) |
| [`ralph-loop-e3-responsividade-real.md`](ralph-loop-e3-responsividade-real.md) | Loop E.3 — responsividade real (critérios operacionais por breakpoint) |
| [`ralph-loop-f1-readiness-por-vertical.md`](ralph-loop-f1-readiness-por-vertical.md) | Loop F.1 — readiness por vertical (estado, causa e ação corretiva) |
| [`ralph-loop-f2-readiness-time-operacao.md`](ralph-loop-f2-readiness-time-operacao.md) | Loop F.2 — readiness do time da operação (estado agregado e gaps críticos) |
| [`ralph-loop-f3-troubleshooting-simples.md`](ralph-loop-f3-troubleshooting-simples.md) | Loop F.3 — troubleshooting simples (causa, impacto e correção rápida) |
| [`ralph-loop-f4-observabilidade-resumida-operacao.md`](ralph-loop-f4-observabilidade-resumida-operacao.md) | Loop F.4 — observabilidade resumida da operação (KPIs executivos mínimos) |
| [`ralph-loop-g1-testes-e2e-ai-builder.md`](ralph-loop-g1-testes-e2e-ai-builder.md) | Loop G.1 — testes E2E do AI Builder (fluxo principal protegido) |
| [`ralph-loop-g2-testes-e2e-verticais-principais.md`](ralph-loop-g2-testes-e2e-verticais-principais.md) | Loop G.2 — testes E2E das verticais principais (regressão crítica de produto) |
| [`ralph-loop-g3-gold-gate-oficial-por-vertical.md`](ralph-loop-g3-gold-gate-oficial-por-vertical.md) | Loop G.3 — GOLD gate oficial por vertical (checklist final obrigatório) |
| [`ralph-loop-h1-revalidacao-periodica-gold-gate.md`](ralph-loop-h1-revalidacao-periodica-gold-gate.md) | Loop H.1 — revalidação periódica do GOLD gate (recertificação pós-aprovação) |
| [`ralph-loop-137-validacao-vertical-perfeita.md`](ralph-loop-137-validacao-vertical-perfeita.md) | Validação pós-137 — checklist de fechamento das verticais agent-first pelos critérios de vertical perfeita |
| [`ralph-loop-138-slice-4-1-crm-smoke-manual.md`](ralph-loop-138-slice-4-1-crm-smoke-manual.md) | Loop 138 — formalização operacional do Slice 4.1 (CRM) para smoke manual e trilha de evidências |
| [`ralph-loop-139-slice-4-2-scheduling-smoke-manual.md`](ralph-loop-139-slice-4-2-scheduling-smoke-manual.md) | Loop 139 — formalização operacional do Slice 4.2 (Scheduling) para smoke manual da agenda e evidência de gate diário |
| [`ralph-loop-140-slice-4-3-finance-smoke-manual.md`](ralph-loop-140-slice-4-3-finance-smoke-manual.md) | Loop 140 — formalização operacional do Slice 4.3 (Finance) para smoke manual financeiro e evidência de gate financeiro |
| [`ralph-loop-141-slice-4-4-clinical-smoke-manual.md`](ralph-loop-141-slice-4-4-clinical-smoke-manual.md) | Loop 141 — formalização operacional do Slice 4.4 (Clinical) para smoke manual clínico e evidência de gate clínico |
| [`ralph-loop-142-slice-4-5-services-sales-smoke-manual.md`](ralph-loop-142-slice-4-5-services-sales-smoke-manual.md) | Loop 142 — formalização operacional do Slice 4.5 (Services/Sales) para smoke manual comercial e evidência de handoff |
| [`ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md`](ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md) | Loop 143 — formalização operacional do Slice 4.6 (Care/Reminders) para smoke manual de cuidado/lembretes e evidência de continuidade |
| [`ralph-loop-144-slice-4-7-platform-ops-smoke-manual.md`](ralph-loop-144-slice-4-7-platform-ops-smoke-manual.md) | Loop 144 — formalização operacional do Slice 4.7 (Platform/Ops) para smoke manual de incidentes/backlog/deploy e evidência administrativa |
| [`ralph-loop-145-encerramento-formal-etapa-4.md`](ralph-loop-145-encerramento-formal-etapa-4.md) | Loop 145 — encerramento formal da Etapa 4 com matriz integralmente ✅ e transição para o ciclo pós-fechamento |
| [`ralph-loop-146-pos-fechamento-etapa-4.md`](ralph-loop-146-pos-fechamento-etapa-4.md) | Loop 146 — sumário executivo pós-fechamento da Etapa 4 e priorização do backlog residual |
| [`ralph-loop-147-execucao-topo-backlog-residual.md`](ralph-loop-147-execucao-topo-backlog-residual.md) | Loop 147 — execução do topo do backlog residual priorizado com critério de saída verificável |
| [`ralph-loop-148-plano-acompanhamento-operacional.md`](ralph-loop-148-plano-acompanhamento-operacional.md) | Loop 148 — plano de acompanhamento operacional com cadência, responsáveis, checkpoints e escalonamento |
| [`ralph-loop-149-execucao-assistida-por-checkpoints.md`](ralph-loop-149-execucao-assistida-por-checkpoints.md) | Loop 149 — execução assistida por checkpoints (1º ciclo operacional completo com evidências e decisão de continuidade) |
| [`ralph-loop-150-endurecimento-modelo-evidencias.md`](ralph-loop-150-endurecimento-modelo-evidencias.md) | Loop 150 — endurecimento do modelo de evidências (template canónico, validação mínima e mapeamento único para ledger) |
| [`ralph-loop-151-automacao-leve-governanca.md`](ralph-loop-151-automacao-leve-governanca.md) | Loop 151 — automação leve de governança (script canónico para registrar checkpoints e anexar evidências) |
| [`ralph-loop-152-telemetria-execucao-checkpoints.md`](ralph-loop-152-telemetria-execucao-checkpoints.md) | Loop 152 — telemetria de execução de checkpoints (métricas de status, decisões e taxa de bloqueio) |
| [`ralph-loop-153-alertas-governanca-excecao.md`](ralph-loop-153-alertas-governanca-excecao.md) | Loop 153 — alertas de governança por exceção (detecção de bloqueio recorrente e disparo operacional) |
| [`ralph-loop-154-tendencia-operacional-previsao-risco.md`](ralph-loop-154-tendencia-operacional-previsao-risco.md) | Loop 154 — tendência operacional e previsão de risco (antecipação de deterioração por série temporal de status) |
| [`ralph-loop-155a-governanca-relacional-care-first.md`](ralph-loop-155a-governanca-relacional-care-first.md) | Loop 155A — governança relacional por produto (care-first) com slices incrementais, regra `phone -> partyId` e trilha de ledger por slice |
| [`ralph-loop-155a-ledger.md`](ralph-loop-155a-ledger.md) | Ledger do Loop 155A — estado do ciclo, checkpoint inicial, progresso por slice e fila residual dos produtos pendentes |
| [§ Loops 88+ no plano mestre](agents-team-crafter-plano-evolucao.md#loops-88-mais-verticais-de-negócio-por-pack) | Verticais por `packId` após o 87 — candidatos, critérios, tamanho do slice *(estado atual: 88–94, 99, 100, 101, 102, 103, 104, 105 e 106 fechados; 95 candidato UX; próximos 96+ por prioridade de domínio)* |

**Gaps em runtime (domínios de negócio — finanças, care, CRM, …):** padrão no plano em [§14.8](agents-team-crafter-plano-evolucao.md#148-runtime-dominios-negocio-gaps); exemplo CRM: [§14.8 — CRM](agents-team-crafter-plano-evolucao.md#148-runtime-crm-clientes-gaps); ledger: [gaps por domínio](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md#gap-runtime-dominios-negocio); fundação + piloto CRM: [Loop 87](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md#loop-87-fechado).

Na raiz de `docs/` existem **atalhos** com o nome antigo dos dois primeiros ficheiros, a apontar para aqui.

Gate: `./scripts/ralph-loop-gate.sh` (na raiz do repositório).


## Próximos loops recomendados (pós-154)

Com base no fechamento do Loop 154 e no estado atual do ledger, a sequência mínima recomendada para manter cadência operacional é:

1. **Loop 155 — Plano adaptativo por criticidade** *(recomendado)*
   - ajustar automaticamente cadência e prioridade conforme criticidade operacional;
   - reduzir reincidência de bloqueios em ciclos sucessivos.
2. **Loop 156 — Cadência automática com limiares operacionais** *(recomendado)*
   - aplicar limiares de risco para disparar revisões mais curtas/mais longas;
   - consolidar rotina semanal/quinzenal com histerese para evitar oscilação.

> Nota: após a implementação do Loop 154, o próximo loop recomendado é o **155**. O 156 é continuação sugerida para automatizar cadência com limiares.


### Fatiamento recomendado do Loop 149 (small slices)

- **149.1:** checkpoint semanal mínimo (status + motivo + owner/prazo).
- **149.2:** revisão quinzenal com decisão explícita e racional (impacto/risco/esforço).
- **149.3:** consolidação de evidências + atualização do ledger.
- **149.4 (condicional):** escalonamento quando houver `blocked` em 2 checkpoints seguidos.


### Fatiamento recomendado do Loop 150 (small slices)

- **150.1:** template canónico de checkpoint.
- **150.2:** checklist de validação mínima.
- **150.3:** convenção de mapeamento para ledger.
- **150.4:** exemplo operacional completo (checkpoint → decisão → ledger).


### Fatiamento recomendado do Loop 151 (small slices)

- **151.1:** CLI mínima com campos obrigatórios.
- **151.2:** validação de enums (`status` e `decisão`).
- **151.3:** geração canónica de bloco markdown.
- **151.4:** anexo direto em ficheiro via `--output`.


### Fatiamento recomendado do Loop 152 (small slices)

- **152.1:** parser mínimo do formato canónico.
- **152.2:** métricas de status (`on-track`/`attention`/`blocked`).
- **152.3:** métricas de decisão (`continuar`/`replanejar`/`escalar`).
- **152.4:** export JSON para integração com governança.


### Fatiamento recomendado do Loop 153 (small slices)

- **153.1:** leitura da sequência de status canónico.
- **153.2:** cálculo de streak de `blocked`.
- **153.3:** regra configurável por threshold.
- **153.4:** output JSON e exit code semântico para automação.
