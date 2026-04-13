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
| [§ Loops 88+ no plano mestre](agents-team-crafter-plano-evolucao.md#loops-88-mais-verticais-de-negócio-por-pack) | Verticais por `packId` após o 87 — candidatos, critérios, tamanho do slice *(estado atual: 88–94, 99, 100, 101, 102, 103, 104, 105 e 106 fechados; 95 candidato UX; próximos 96+ por prioridade de domínio)* |

**Gaps em runtime (domínios de negócio — finanças, care, CRM, …):** padrão no plano em [§14.8](agents-team-crafter-plano-evolucao.md#148-runtime-dominios-negocio-gaps); exemplo CRM: [§14.8 — CRM](agents-team-crafter-plano-evolucao.md#148-runtime-crm-clientes-gaps); ledger: [gaps por domínio](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md#gap-runtime-dominios-negocio); fundação + piloto CRM: [Loop 87](agents-team-crafter-plano-evolucao_IMPLEMENTADO.md#loop-87-fechado).

Na raiz de `docs/` existem **atalhos** com o nome antigo dos dois primeiros ficheiros, a apontar para aqui.

Gate: `./scripts/ralph-loop-gate.sh` (na raiz do repositório).
