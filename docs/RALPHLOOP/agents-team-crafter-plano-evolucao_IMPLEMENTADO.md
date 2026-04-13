

`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`



`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`

`agents-team-crafter` Ralph Loop Implementado

## Resumo executivo

Este arquivo continua sendo a fonte oficial de retomada do Ralph Loop para o roadmap em `docs/RALPHLOOP/agents-team-crafter-plano-evolucao.md` (toda a documentação canónica do Ralph Loop vive em **`docs/RALPHLOOP/`**).

**Fase actual do produto:** **Loops 82–94** estão **fechados** na linha de **team planner + AI Builder** (**82–86** + **89**), **especialistas operacionais** (**87** — [Loop 87 fechado](#loop-87-fechado)), **readiness** (**88** — [Loop 88 fechado](#loop-88-fechado)), **AI Builder UX** (**89** — [Loop 89 fechado](#loop-89-fechado)), **cockpit na ficha do time** (**90** — [Loop 90 fechado](#loop-90-fechado)), **console de debug operacional** (**91** — [Loop 91 fechado](#loop-91-fechado)), **CTAs de resolução no readiness** (**92** — [Loop 92 fechado](#loop-92-fechado)), **runs legíveis / troubleshooting** (**93** — [Loop 93 fechado](#loop-93-fechado)) e **templates operacionais / cenários dourados** (**94** — [Loop 94 fechado](#loop-94-fechado)). Na frente transversal de contrato de tools, **Loops 98.1–98.9** estão **fechados** ([98.1](#loop-981-fechado--norma-oficial-de-contrato-de-tools), [98.2](#loop-982-fechado--pipeline-canónico-do-boundary-da-tool), [98.3](#loop-983-fechado--observabilidade-obrigatória-do-contrato), [98.4](#loop-984-fechado--retry-seguro-e-limitado), [98.5](#loop-985-fechado--contrato-explícito-de-prompts-alinhado-ao-runtime), [98.6](#loop-986-fechado--biblioteca-de-normalização-por-actionid), [98.7](#loop-987-fechado--matriz-de-segurança-por-actionid), [98.8](#loop-988-fechado--debug-conversacional-e-ux-de-incidente), [98.9](#loop-989-fechado--regressão-mínima-por-pack)). **Próximo slice oficial em aberto:** verticais de negócio em **Loops 96+** (a numerar por `packId` prioritário). **Loop 95** permanece candidato de polimento UX operacional. **Paralelamente (macro):** [14.8 — Riscos e decisões em aberto](agents-team-crafter-plano-evolucao.md#148-riscos-e-decisões-em-aberto) (billing, 2FA, self-service).

**Após o Loop 87 (fechado)**, a sequência **recomendada** no plano mestre continua a focar **operação real de times**, **readiness**, **cockpit na página do time**, **debug conversacional legível** e **troubleshooting** (macro-onda candidata **88–95** — ver [backlog recomendado](#backlog-recomendado-após-o-loop-87) e [plano §88+ operação](agents-team-crafter-plano-evolucao.md#loops-88-operacao-real-ux-troubleshooting)). Tratar cada número **88+** como **candidato** até haver secção **Loop N (fechado)** no ledger.

Regras de uso:

- ler este arquivo antes de iniciar o próximo loop
- executar apenas um slice coerente por loop
- **gate obrigatório antes de encerrar o ciclo:** `npm run build` e `npm test` em `backend/` (e `npm run build` em `v0-team-ai-crafter/` se o slice tocar no frontend); atalho: `./scripts/ralph-loop-gate.sh` (opcional `RALPH_LOOP_INCLUDE_FRONTEND=1`)
- ao final de cada etapa/loop oficialmente concluído, fazer **commit de tudo** e **push** antes de marcar o ciclo como encerrado no ledger
- atualizar o status por etapa, o checklist do loop encerrado e a secção **Próximo loop oficial** ao final de cada ciclo

### Cerimônia Ralph (um ciclo)

1. Ler este ledger + o plano mestre (`docs/RALPHLOOP/agents-team-crafter-plano-evolucao.md`) para o contexto da etapa.
2. Trabalhar **um único** loop (um slice coerente); não misturar dois loops no mesmo PR/ciclo.
3. Implementar e validar com o **gate** (build → testes; frontend se aplicável).
4. Se o gate falhar, corrigir no **mesmo** loop até passar — só então avançar.
5. Fazer **commit de tudo** e **push** do loop/etapa concluído.
6. Atualizar este ficheiro: tabela de estado, checklist do loop concluído, definição do **próximo** loop oficial.
7. Se o slice tocar **criação de times por IA** (planner, `team-plan-planner-prompt`, schema, AI Builder): no texto do encerramento, mapear quais **micro-etapas** ([A–K](#micro-etapas-ralph-criacao-times-ia); **F–G** = pré-JSON + reparo servidor; **H–K** = UX preview / progressive disclosure no [`TeamAiBuilder`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)) passaram a estar garantidas por código ou prompt e quais ficam só na norma.

### Checklist: ferramentas Agents SDK utilizáveis (após gate verde)

O `./scripts/ralph-loop-gate.sh` (build + testes no `backend/`, e frontend opcional) **não** substitui provar que uma tool faz chamada real a integrações externas. Ao fechar um loop que altere ferramentas, confirmar no texto do ledger que a entrega **não** promove a falsa expectativa de “habilitou na UI = funciona” sem pré-condições.

Verificação mínima quando o slice toca em tools:

- **Catálogo (`capabilities.tools`):** para IDs que o runtime só executa com integração, o loop deve dizer se ficou **operacional** (integração + caminho feliz) ou **stub**; alinhar com [`operational-catalog-tools.ts`](../../backend/src/modules/agents/domain/operational-catalog-tools.ts) e a matriz em [`docs/UI-RUNTIME-AGENT.md`](../UI-RUNTIME-AGENT.md).
- **`http_webhook`:** URL acessível, contrato e autenticação documentados ou cobertos por teste; sem isso, declarar limitação.
- **`internal_action`:** presets em [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts) + catálogo read-only `GET /api/v1/business-actions/catalog`; `actionId` resolvível no registry de negócio e `businessToolRuntime` disponível no compose do agente.
- **`builtin_ref`:** tratar como **alias/placeholder** no runtime atual (não duplica executores do catálogo); não prometer paridade com as tools de catálogo até haver evolução explícita de produto/código.
- **Smoke manual** de tool “real” (Postgres, CRM, MCP HTTP, etc.), quando aplicável, fica a cargo do slice e pode exigir ambiente com segredos — **fora** do gate por defeito.
- O **Loop 60** removeu o `crm_access` HTTP do catálogo e `toolCrm` em Integrações; validar CRM de negócio via pack `crm` / `internal_action` e documentação correspondente. **Gaps observados** no uso real (mesmo padrão noutros domínios): ver [Gaps — domínios de negócio](#gap-runtime-dominios-negocio).

<a id="norma-builtin-dominio-agente"></a>

### Norma de produto — ferramentas builtin por domínio do agente (criação de time)

Requisito explícito alinhado ao plano mestre ([§2.6](agents-team-crafter-plano-evolucao.md#26-ferramentas-openai-agents-sdk-utilizáveis-vs-apenas-habilitadas) — subsecção **Seleção de ferramentas por domínio do agente e defaults na criação de times**; âncora [§2.6 — seleção por domínio](agents-team-crafter-plano-evolucao.md#sec-selecao-ferramentas-dominio)):

- **Na criação de um time**, ao mostrar ferramentas **builtin** por agente especialista, devem aparecer **já selecionadas e ativadas** **somente** as tools que **esse** agente precisa usar — não um conjunto genérico nem “tudo desligado”.
- A seleção é **por domínio do agente**: dois especialistas **diferentes** não devem, por defeito, carregar o **mesmo** pacote de ferramentas sem critério; cada um recebe o subconjunto adequado ao seu domínio.
- **Um especialista por domínio de assunto** — apenas um agente deve **definir a resposta** e a **propriedade operacional** sobre aquele âmbito temático no time; o coordenador continua a ser a interface externa.
- **Inventário explícito de builtins** — ao desenhar ou gerar especialistas (incluindo IA), deve ficar claro **se** e **quais** IDs do catálogo (`capabilities.tools` / `catalogTools`) cada especialista necessita; não copiar listas entre agentes “por hábito”.
- **Unicidade de builtins de negócio** — no mesmo time, **dois especialistas não podem** partilhar o **mesmo ID** de builtin cuja função primária é um **domínio de negócio** (critério detalhado no plano mestre; alinhar a [`operational-catalog-tools.ts`](../../backend/src/modules/agents/domain/operational-catalog-tools.ts) no slice de enforcement). Utilitários genuinamente transversais no catálogo devem ter regra explícita em prompt/código para não mascarar duplicação de domínio.
- **Âmbito** — a regra aplica-se ao par **`workspaceId` × mesmo team plan**; **não** colide com outro time no workspace nem com outro workspace.

Slices futuros que toquem no AI Builder, wizard de times ou fichas de agente devem verificar esta norma na UX e na persistência (`capabilities.tools` / binds). **Loops 77–78** do plano mestre: [prompts](#loop-77-fechado) + [enforcement](#loop-78-fechado). **Loop 80** (fechado): [outer loop de auto-reparo pela IA](#loop-80-fechado) no `POST` de criação de plano ([plano mestre § Loop 80](agents-team-crafter-plano-evolucao.md#loop-80-planner-auto-repair-ia)).

<a id="micro-etapas-ralph-criacao-times-ia"></a>

### Metodologia Ralph Loop — micro-etapas (criação de times por IA)

Espelho operacional do plano mestre ([metodologia](agents-team-crafter-plano-evolucao.md#metodologia-ralph-criacao-times-ia)). Ao encerrar um slice que altere `team-plan-planner-prompt.ts`, schema do planner ou AI Builder, o ledger deve indicar quais micro-etapas ficaram **cobertas por código/prompt** vs **ainda só documentadas**:

| ID | Micro-etapa | Nota para o ledger |
| --- | --- | --- |
| A | Partição de domínios (1 especialista ↔ 1 domínio de assunto) | Domínio → papel; sem dois papéis no mesmo domínio. |
| B | Inventário de builtins por especialista | IDs só do catálogo permitido; marcar quais são **de negócio**. |
| C | Verificação de unicidade entre especialistas (mesmo `workspaceId`, mesmo team plan) | Interseção de IDs de negócio vazia **neste** time; outros times/workspaces são independentes. |
| D | JSON válido + normalização no servidor | `plannerOutputSchema` / `catalogTools`; fallback honesto ([Loop 62](#loop-62-fechado)). |
| E | Gate `./scripts/ralph-loop-gate.sh` (+ frontend se Next) | Commit + push antes de marcar loop fechado. |
| F | Matriz pré-JSON (planeamento) | Antes do JSON final: uma linha por especialista com `catalogTools` mínimas; cada ID exclusivo em **no máximo** um especialista. |
| G | Outer loop de auto-reparo IA ([Loop 80](#loop-80-fechado), estendido [Loop 86](#loop-86-fechado)) | Gerar → `getSpecialistsCatalogToolConflicts` **e** `getSpecialistWorkflowConflicts` → se falhar, **reemitir** com diagnóstico (segunda chamada OpenAI); limite `TEAM_PLAN_CATALOG_REPAIR_MAX_ATTEMPTS` + `plannerMeta.catalogToolRepairAttempts` / `catalogUniquenessRepaired`. |
| H | Leitura rápida do plano ([Loop 81](#loop-81-fechado)) | Primeiro ecrã: equipa + agentes + **objectives**; sem grelha completa de tools por defeito. |
| I | Tools resumidas + edição focalizada ([Loop 81](#loop-81-fechado)) | Chips com tools activas; modal/drawer para toggles completos; colisão só para `SPECIALIST_EXCLUSIVE_*` entre especialistas. |
| J | Progressive disclosure ([Loop 81](#loop-81-fechado)) | Grafo e detalhes longos do agente em **Collapsible**; bind/packs mantêm cartão dedicado quando aplicável. |
| K | Gate UX ([Loop 81](#loop-81-fechado)) | `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` + smoke do fluxo assistido. |

**Inner loop (engenharia Ralph):** falha estrutural em C, D, F ou G → corrigir no **mesmo** Ralph Loop (prompt, schema, serviço de reparo ou `planner-agent-catalog-tools`), não apenas copy na UI.

**Outer loop (produto — geração):** **G** implementa **gerar → validar → reparar com IA → validar** até sucesso ou limite, alinhado à disciplina “gate verde antes de avançar” sem expor `VALIDATION_ERROR` no caminho feliz do assistente ([diagrama no plano mestre](agents-team-crafter-plano-evolucao.md#metodologia-ralph-outer-loop-planner)).

**Estado actual (pós Loop 87):** além de **Loops 82–86** (team planner + AI Builder), o **[Loop 87](#loop-87-fechado)** entregou **especialistas operacionais** (schemas estritos, CRM piloto, slot-filling, debug com `conversationId`). **Loops 88–94** fecharam readiness, AI Builder em camadas, cockpit, console, CTAs, runs legíveis e **guia de validação em templates**. **Próximo foco recomendado:** **[Loop 95](#loop-95-candidato--polimento-ui-padrão-e-responsivo-da-operação)** (candidato); em paralelo [14.8](agents-team-crafter-plano-evolucao.md#148-riscos-e-decisões-em-aberto) quando aplicável.

<a id="gap-runtime-dominios-negocio"></a>
<a id="gap-runtime-crm-clientes"></a>

### Gaps em runtime — domínios de negócio (padrão; CRM como caso documentado)

Registo **operacional** para não perder contexto entre ciclos. Plano mestre: [§14.8 — gaps por domínio](agents-team-crafter-plano-evolucao.md#148-runtime-dominios-negocio-gaps); exemplo **CRM** (âncora legada): [§14.8 — CRM](agents-team-crafter-plano-evolucao.md#148-runtime-crm-clientes-gaps).

**Norma:** os mesmos tipos de sintoma observados em CRM — schema de catálogo inválido, parâmetros obrigatórios pouco naturais, contrato genérico em `internal_action`, fluxos de escrita sem elicitação em lote — **aplicam-se a qualquer pack** (finanças, care, agendamento, …). A correção é **em duas camadas**: (1) **fundação transversal** no [Loop 87](#loop-87-oficial); (2) **vertical por domínio** em **Loops 96+** (verticais por `packId`), um recorte coerente por ciclo — ver [plano §96+](agents-team-crafter-plano-evolucao.md#loops-88-mais-verticais-de-negócio-por-pack). A macro-onda de **operação / UX 88–95** ([plano](agents-team-crafter-plano-evolucao.md#loops-88-operacao-real-ux-troubleshooting)) é **outra frente** (readiness, cockpit, debug narrativo, etc.), **não** substitui verticais por pack.

| Sintoma (transversal) | Notas |
| --- | --- |
| `400 Invalid schema for function 'catalog_internal_actions'` (ou outra `catalog_*`) | Modo estrito: `required` vs `properties` — ex.: **`query` ausente** de `required`. Referência: [`build-specialist-sdk-tools.ts`](../../backend/src/modules/runtime/application/build-specialist-sdk-tools.ts). |
| Consulta/listagem pouco natural | Parâmetros que o utilizador não deveria ter de adivinhar; falta de defaults ou de ações com filtros opcionais — **replicável** em contas, subjectos de care, etc. |
| Cadastro / escrita sem slot-filling | Agente só confirma quando o utilizador já deu tudo; **esperado:** intenção + obrigatórios + **uma pergunta** com o que falta. |

**Exemplo concreto — CRM / clientes** (piloto do Loop 87; mesmo checklist mental para outros packs):

| Sintoma | Notas |
| --- | --- |
| Listar clientes / clientes ativos | Invocação sem **`query`** ou sem semântica de “ativo”; alinhar schema, modelo de dados e ações `crm_*`. |
| Cadastro de cliente | Ver linha “cadastro / escrita” na tabela transversal. |

**Estado:** **fundação + piloto CRM** em tratamento no [Loop 87](#loop-87-oficial); **verticais adicionais** (finanças, care, …) em **Loops 96+** — não dispersar correções fora do recorte sem actualizar o anexo [`ralph-loop-87-especialistas-operacionais.md`](ralph-loop-87-especialistas-operacionais.md) ou o ledger do loop numerado correspondente.

### Diagnóstico operacional pós Loops 82–86

Os **Loops 82–86** fecharam grande parte da **criação assistida** (team planner + AI Builder). O **[Loop 87](#loop-87-oficial)** é a ponte para **especialistas operacionais** em runtime (schemas, CRM, slot-filling, contexto no debug). O **próximo backlog recomendado** no plano mestre é a **operação real de times**: confiança, rapidez e pouca fricção ao validar, corrigir e produzir.

**Gaps de produto observados (orientação; não antecipam entregas):**

- **AI Builder** ainda denso numa única superfície para quem só quer «criar e ir»
- **Página do time** sem cockpit de **prontidão** consolidada
- **Console de debug** ainda mais próximo de ferramenta técnica do que de investigação narrativa rápida
- **Runs** pouco legíveis para troubleshooting
- Falta de fluxo claro de **resolver pendências** a partir do estado do time (CTAs directos)

Ver [backlog candidato 88–95](#backlog-recomendado-após-o-loop-87) e o [plano mestre §88+ operação](agents-team-crafter-plano-evolucao.md#loops-88-operacao-real-ux-troubleshooting).

<a id="backlog-recomendado-após-o-loop-87"></a>

## Backlog recomendado após o Loop 87

| Loop | Tema | Estado |
| ---- | ---- | ------ |
| 88 | Preflight operacional / readiness do time | fechado |
| 89 | AI Builder — modo simples por defeito, avançado sob demanda | fechado |
| 90 | Cockpit operacional do time | fechado |
| 91 | Console conversacional com sessões e timeline | fechado |
| 92 | Resolver pendências com CTA directo | fechado |
| 93 | Runs legíveis, replay e troubleshooting | fechado |
| 94 | Templates operacionais e cenários dourados | fechado |
| 95 | Polimento UI padrão e responsiva da operação | candidato |

### Admin global da plataforma: norma vs implementação actual

**Norma (contrato de produto):** apenas o **admin global** (`isPlatformAdmin` no utilizador e/ou `PLATFORM_ADMIN_EMAILS` em [`env.ts`](../../backend/src/config/env.ts); enforcement [`hooks.ts`](../../backend/src/app/plugins/hooks.ts)) pode realizar operações **cross-tenant** sensíveis: ver **todos** os utilizadores e **todos** os workspaces da instalação; eliminar **em cascata** um utilizador e os dados MongoDB associados (workspaces, membros, convites, etc., segundo política da implementação). Owner/admin **de workspace** não substitui este papel.

**Estado actual no repositório:**

| Capacidade | Situação |
| ---------- | -------- |
| Listar **todos os workspaces** (instalação) | **Parcialmente entregue:** `GET /workspaces` retorna [`workspaceRepo.listAll()`](../../backend/src/modules/workspaces/interfaces/workspace.routes.ts) quando `req.user.isPlatformAdmin`. |
| Listar **todos os utilizadores** (instalação) | **Ainda não** há endpoint/API dedicada documentada; tratar como **evolução** até existir rota + serviço + testes. |
| **Delete em cascata por utilizador** | **Ainda não** implementado como operação selectiva; o [factory reset](../../backend/src/modules/platform/interfaces/platform.routes.ts) (`POST /platform/danger-zone/factory-reset`) faz wipe **global** da base — não é equivalente a apagar um só utilizador. |

Alinhamento com o plano mestre: [§2.7 Admin global da plataforma](agents-team-crafter-plano-evolucao.md#27-admin-global-da-plataforma-rbac-cross-tenant).

### Norma de produto — UX responsiva e onboarding contextual por tela

Requisito explícito alinhado ao plano mestre ([§2.8](agents-team-crafter-plano-evolucao.md#28-ux-responsiva-e-onboarding-contextual-por-tela)):

- **Responsividade é parte do produto**: telas críticas devem continuar funcionais em `desktop`, `tablet` e `mobile`, sem depender de zoom, scroll horizontal constante ou precisão de cursor.
- **Melhor prática adotada para “explicar a plataforma”**: usar **onboarding contextual progressivo por tela**, e **não** um tour global obrigatório e repetitivo.
- **Disparo do tour**: mostrar ajuda contextual quando o utilizador autenticado entra pela **primeira vez** na tela (ou quando a `tourVersion` mudar) e permitir reabertura manual via CTA previsível.
- **Persistência**: guardar estado por `userId` + `workspaceId` + `screenKey` + `tourVersion`.
- **Slice Ralph**: primeiro a foundation responsiva, depois as telas críticas, e só então a expansão dos tours por lotes pequenos de views.

Slices futuros que toquem UI/UX devem declarar no ledger:

- quais rotas ficaram responsivas em `tablet` e `mobile`;
- quais telas receberam tour contextual;
- como a persistência do onboarding foi versionada ou alterada no slice.

---

# Status por etapa do plano


| Etapa                                                  | Prioridade | Status       | Observação                                                                                               |
| ------------------------------------------------------ | ---------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| ETAPA 0 - contrato runtime/UX/grafo                    | altíssima  | concluído    | coordinator-first consolidado                                                                            |
| ETAPA 1 - governança de domínio                        | máxima     | concluído    | overlap guard e bloqueio integrados                                                                      |
| ETAPA 2 - wizard de criação de agentes                 | máxima     | concluído    | `agent-plans` e wizard assistido entregues                                                               |
| ETAPA 3 - unificação da criação de times               | alta       | concluído    | hub unificado entregue                                                                                   |
| ETAPA 4 - execução persistida                          | alta       | concluído    | `runs`, `run_steps`, `run_events`                                                                        |
| ETAPA 5 - simplificação do grafo                       | alta       | concluído    | hub-and-spoke refletido na UI                                                                            |
| ETAPA 6 - agentes/times da plataforma                  | média-alta | concluído    | catálogo sistêmico inicial publicado                                                                     |
| ETAPA 7 - governança, auditoria e rollout              | média      | concluído    | loops 5–16 concluídos                                                                                    |
| ETAPA 8 - Business Tools Platform / Packs Multi-tenant | altíssima  | concluído    | Loops 17–51 entregues; ETAPA 8 encerrada; ETAPA 9 iniciada (Loop 52 entregue)                         |
| ETAPA 9 - Paridade de produção, configurações e operação | altíssima | em curso (52–94 fechados; [Loop 95](#loop-95-candidato--polimento-ui-padrão-e-responsivo-da-operação) candidato) | Loops **52–94** entregues; **próximo candidato numerado:** [Loop 95](agents-team-crafter-plano-evolucao.md#loop-95--polimento-final-de-ui-padrão-e-responsiva-para-operação); [Loop 94 fechado](#loop-94-fechado): guia de validação e prompts em templates; billing/2FA: [14.8](agents-team-crafter-plano-evolucao.md#148-riscos-e-decisões-em-aberto) |


---

# Loops já executados

## Loops 0–16

Os loops 0–16 foram executados e fecharam a fase de:

- governança de domínio
- criação guiada de agentes
- criação guiada de times
- runs persistidas
- simplificação do grafo
- auditoria operacional
- feature flags
- tendências
- SLO
- webhook de SLO

A história detalhada desses loops permanece válida e faz parte da trajetória do projeto.

---

# Nova frente ativa — Business Tools Platform

## Objetivo da nova frente

Transformar o sistema de tools em uma plataforma real de capabilities de negócio multi-tenant.

## Resultado esperado

Permitir que múltiplos agentes e times usem, com segurança e isolamento por workspace, tools reais como:

- CRM
- cadastro de paciente/pet
- anamnese e evolução
- catálogo de serviços
- vendas
- pacotes
- atendimento por pacote
- contas a pagar
- contas a receber
- lembretes
- GitHub Ops

---

# Loops previstos da nova frente

## Loop 17

- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: foundation de business tools
- foco:
  - adicionar `internal_action`
  - criar `business-tool-runtime`
  - criar `business-tool-registry`
  - introduzir auditoria `business_tool_audit`
- arquivos-alvo:
  - `backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts`
  - `backend/src/modules/tool-definitions/infra/workspace-tool-definition.model.ts`
  - `backend/src/modules/runtime/application/build-workspace-custom-tools.ts`
  - `backend/src/modules/business-tools/application/business-tool-runtime.ts`
  - `backend/src/modules/business-tools/application/business-tool-registry.ts`
- critério de saída:
  - uma tool interna consegue ser executada por agente com `workspaceId` resolvido corretamente

## Loop 18

- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: CRM Pack
- foco:
  - `parties`
  - CRUD semântico de partes
  - tools CRM
- entregas:
  - `crm_create_party`
  - `crm_update_party`
  - `crm_find_party`
  - `crm_get_party_summary`
  - `crm_list_parties_by_role`

## Loop 19

- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Care Pack
- foco:
  - `care_subjects`
  - humano x animal
  - vínculo com `party`
- entregas:
  - `care_create_subject`
  - `care_update_subject`
  - `care_find_subject`
  - `care_get_subject_summary`

## Loop 20

- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Services & Sales Pack
- foco:
  - `service_catalog`
  - `service_orders`
  - histórico de compra
  - total pago por serviço
- entregas:
  - `service_catalog_create_item`
  - `service_catalog_list_items`
  - `sales_create_service_order`
  - `sales_add_service_item`
  - `sales_mark_order_paid`
  - `sales_get_customer_purchase_history`
  - `sales_top_services`
  - `sales_total_paid_by_service`

## Loop 21

- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Packages & Encounters
- foco:
  - `package_sales`
  - `encounters`
  - saldo de pacote
- entregas:
  - `package_sell_to_party`
  - `package_get_balance`
  - `attendance_register_session`
  - `attendance_list_by_party`
  - `attendance_list_by_package_sale`
  - `attendance_get_party_care_summary`

## Loop 22

- etapa/prioridade: ETAPA 8 / média-alta
- objetivo do slice: Clinical Records Pack
- foco:
  - `anamneses`
  - `evolution_notes`
  - `encounters` clínicos
- entregas:
  - `clinical_create_anamnesis`
  - `clinical_add_evolution_note`
  - `clinical_list_subject_history`
  - `clinical_get_latest_evolution`
  - `clinical_open_encounter`
  - `clinical_close_encounter`

## Loop 23

- etapa/prioridade: ETAPA 8 / média-alta
- objetivo do slice: Finance Pack
- foco:
  - `receivables`
  - `payables`
  - overdue
  - agregações
- entregas:
  - `finance_create_receivable`
  - `finance_create_payable`
  - `finance_mark_receivable_paid`
  - `finance_mark_payable_paid`
  - `finance_list_overdue_receivables`
  - `finance_list_overdue_payables`
  - `finance_total_receivable_by_payer`
  - `finance_total_payable_by_destination`
  - `finance_customer_financial_summary`

## Loop 24

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: Reminder Pack
- foco:
  - `reminders`
  - lembretes por data/hora
- entregas:
  - `schedule_create_reminder`
  - `schedule_list_reminders_by_date`
  - `schedule_mark_reminder_done`
  - `schedule_cancel_reminder`

## Loop 25

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: GitHub Ops Pack
- foco:
  - PR read/diff/comment
  - arquivos alterados
  - issue read
- entregas:
  - `github_read_pr`
  - `github_read_diff`
  - `github_comment_pr`
  - `github_list_changed_files`
  - `github_get_issue`

## Loop 26

- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: integrar packs e tools reais ao AI Builder
- foco:
  - planner sugerindo packs
  - review mostrando capabilities
  - execute plan com install/bind
- entregas:
  - `requiredPacks`
  - `requiredTools`
  - instalação automática de packs
  - bind de `toolDefinitionIds` aos agentes
- estado no repositório:
  - **fase 1 entregue:** `requiredPacks` / `requiredTools` no JSON do planner, persistência em `TeamPlan`, `responseMeta` e auditoria na execução
  - **fase 2:** ficou para o **Loop 27** (install automático + bind de `toolDefinitionIds`)

## Loop 27

- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: completar a integração AI Builder — **instalação/bind** de business tools a partir do planner
- depende de: Loop 26 fase 1 (`requiredPacks`, `requiredTools` já no plano e na execução)
- foco:
  - política explícita (workspace / feature flag) para **auto-criar** ou **reutilizar** `WorkspaceToolDefinition` (`kind: internal_action`, `config.actionId`)
  - mapear `requiredTools` (e opcionalmente packs via `requiredPacks`) para definitions por `workspaceId`
  - no fluxo de **execute** do team plan (ou serviço dedicado): anexar `customToolDefinitionIds` aos agentes criados conforme o plano
  - **UI** no fluxo de criação de time por IA: revisão das capabilities sugeridas (mínimo: mostrar e confirmar antes de aplicar bind)
- arquivos-alvo (indicativos):
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/modules/tool-definitions/` (repositório, modelo)
  - `backend/src/modules/agents/` (capabilities / `customToolDefinitionIds`)
  - `v0-team-ai-crafter/` (AI create team / revisão do plano)
- critério de saída (Ralph):
  - com um plano que inclua `requiredTools` válidos, após **execute** os agentes relevantes ficam com tool definitions resolvíveis no runtime **ou** a política documenta explicitamente o modo “só sugestão” sem bind e o utilizador confirma na UI
  - **gate verde:** `./scripts/ralph-loop-gate.sh` (e frontend se o slice alterar `v0-team-ai-crafter/`)
- **entregue no repositório:**
  - `TEAM_PLAN_AUTO_BIND_TOOLS` (`0`|`1`, default `0`) em `[backend/src/config/env.ts](../../backend/src/config/env.ts)`
  - `collectPlannerActionIds` + `PLANNER_PACK_TO_ACTION_IDS` em `[planner-pack-presets.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - `ensureInternalActionDefinitions` + `findBySlug` no repositório de tool definitions
  - fase `binding_tools` no `executePlan` e `responseMeta` (`autoBindEnabled`, `boundToolDefinitionIds`)
  - ADR `[docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md](../adr/ADR-2026-04-team-plan-auto-bind-tools.md)`
  - UI: alerta com packs/tools no `[team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`

## Loop 28

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: testes de integração do bind, hardening (idempotência, limites), observabilidade opcional
- critério de saída: gate verde + documentação mínima no ledger
- **entregue no repositório:**
  - integração: `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)` — `TEAM_PLAN_AUTO_BIND_TOOLS=1`, `requiredTools`, `GET /agents/:id` confirma `capabilities.customToolDefinitionIds`; segundo `execute` com mesmo `operationId` não reprocessa bind
  - hardening: teto de **64** actionIds por execução (`TEAM_PLAN_AUTO_BIND_MAX_ACTIONS` em `[team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`) antes de `ensureInternalActionDefinitions`

## Loop 29

- etapa/prioridade: ETAPA 8 / baixa–média
- objetivo do slice: observabilidade do bind + UX mínima quando a lista é truncada
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - Backend: logs pino `team_plan.auto_bind_summary` (info) ou truncagem com `warn` + campos `workspaceId`, `teamPlanId`, `correlationId`, contagens; payload de auditoria `governance.team_plan_execute` com `autoBindActionsRequested` / `autoBindActionsTruncated`
  - API: `responseMeta` com `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated` em `[team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`
  - Frontend: tipo `[TeamPlanExecuteMeta](../../v0-team-ai-crafter/lib/types/index.ts)` + toast se `autoBindActionsTruncated` em `[team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`
  - ADR atualizado: `[ADR-2026-04-team-plan-auto-bind-tools.md](../adr/ADR-2026-04-team-plan-auto-bind-tools.md)`

## Loop 30

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: ampliar mapeamento pack → actionIds e alinhar o prompt do planner à lista canónica de packs
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[planner-pack-presets.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.ts)`: mais actionIds por pack (só registados no `BusinessToolRegistry`); export `PLANNER_PACK_IDS`
  - `[team-plan-planner-prompt.ts](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts)`: `requiredPacks` referencia dinamicamente `PLANNER_PACK_IDS` (strings exatas)
  - `[planner-pack-presets.test.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`: cobertura finance + invariante `PLANNER_PACK_IDS`

## Loop 31

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX (rótulos PT-BR por pack no AI Builder) + documentação no README do backend; métricas Prometheus ficam para iteração futura (dependência `prom-client` ainda não no projeto)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../../v0-team-ai-crafter/lib/planner-pack-labels.ts)` + badges com `title` = id canónico em `[team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`
  - `[backend/README.md](../../backend/README.md)`: secção **Team plans: packs do planner** com ligações a `planner-pack-presets.ts`, prompt e ADR de bind

## Loop 32

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expor métricas Prometheus (`/metrics`) para team-plan execute/bind
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - dependência `prom-client` adicionada ao backend
  - `[backend/src/app/metrics.ts](../../backend/src/app/metrics.ts)`: registry singleton + default metrics + counters/histograms de `team-plan execute` e auto-bind
  - `[backend/src/app/app.ts](../../backend/src/app/app.ts)`: `GET /metrics`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: instrumentação de sucesso/erro/idempotência e contagens de auto-bind
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: smoke de `/metrics` + nomes de métricas
  - `[backend/README.md](../../backend/README.md)`: secção de observabilidade

## Loop 33 — Scheduling / Appointments Pack

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: abrir o pack de agenda operacional para fechar o fluxo venda → agendamento → lembrete → atendimento
- foco:
  - `appointments` e `availability_slots`
  - vínculo com `party` e/ou `care_subject`
  - integração inicial com `service_orders`, `package_sales`, `encounters` e `reminders`
  - actionIds candidatos:
    - `schedule_create_appointment`
    - `schedule_reschedule_appointment`
    - `schedule_cancel_appointment`
    - `schedule_confirm_appointment`
    - `schedule_mark_no_show`
    - `schedule_list_agenda_by_date`
    - `schedule_get_availability`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[backend/src/modules/scheduling/infra/appointment.model.ts](../../backend/src/modules/scheduling/infra/appointment.model.ts)` e `[availability-slot.model.ts](../../backend/src/modules/scheduling/infra/availability-slot.model.ts)`
  - `[backend/src/modules/scheduling/infra/appointment.repository.ts](../../backend/src/modules/scheduling/infra/appointment.repository.ts)` e `[availability-slot.repository.ts](../../backend/src/modules/scheduling/infra/availability-slot.repository.ts)`
  - `[backend/src/modules/scheduling/application/register-scheduling-pack.ts](../../backend/src/modules/scheduling/application/register-scheduling-pack.ts)`: actions de agenda + integração mínima com `party`, `care_subject`, `service_orders`, `package_sales`, `encounters` e `reminders`
  - integração no registry/container via `[register-all-business-packs.ts](../../backend/src/modules/business-tools/application/register-all-business-packs.ts)` e `[config/container.ts](../../backend/src/config/container.ts)`
  - planner: pack `scheduling` em `[planner-pack-presets.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - frontend: label `scheduling` em `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../../v0-team-ai-crafter/lib/planner-pack-labels.ts)`
  - testes: `[register-scheduling-pack.test.ts](../../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts)` + expansão em `[planner-pack-presets.test.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`

## Loop 34

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: garantir contrato entre `PLANNER_PACK_IDS` (backend) e `PLANNER_PACK_LABELS_PT` (frontend), evitando drift entre planner/bind/UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - teste de contrato em `[backend/src/modules/team-planning/application/planner-pack-presets.test.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`
  - leitura direta do ficheiro `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../../v0-team-ai-crafter/lib/planner-pack-labels.ts)` sem criar nova fonte de verdade

## Loop 35

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expandir o pack `scheduling` para concluir appointments em atendimentos efetivos
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - action `schedule_complete_appointment` em `[backend/src/modules/scheduling/application/register-scheduling-pack.ts](../../backend/src/modules/scheduling/application/register-scheduling-pack.ts)`
  - `EncounterRepository.create` passa a aceitar `careSubjectId` e o `appointment` concluído passa a referenciar o `encounter`
  - `AppointmentRepository.complete(...)` para fechar appointment com `status: completed` e `encounterId`
  - preset do pack `scheduling` ampliado em `[planner-pack-presets.ts](../../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - teste de conclusão em `[register-scheduling-pack.test.ts](../../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts)`: cria `encounter` e marca reminder como `done`

## Loop 36

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: expor uma API HTTP mínima de agenda sobre o pack `scheduling`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - rotas autenticadas em `[backend/src/modules/scheduling/interfaces/scheduling.routes.ts](../../backend/src/modules/scheduling/interfaces/scheduling.routes.ts)`
  - registo global em `[backend/src/app/routes.ts](../../backend/src/app/routes.ts)`
  - endpoints `GET /schedule/agenda`, `GET /schedule/appointments`, `POST /schedule/availability` e mutações `POST /schedule/appointments/:id/`*
  - teste de integração `[backend/src/__tests__/scheduling-api.integration.test.ts](../../backend/src/__tests__/scheduling-api.integration.test.ts)`
  - README backend atualizado com a surface da Scheduling API

## Loop 37

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: UI mínima de agenda consumindo `/api/v1/schedule/...`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - página `[schedule/page.tsx](../../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)`: dia (`GET /schedule/agenda`), compromissos com ações (confirmar, cancelar, falta, concluir), diálogos para novo compromisso e nova janela de disponibilidade
  - entrada de navegação **Agenda** em `[app-sidebar.tsx](../../v0-team-ai-crafter/components/layout/app-sidebar.tsx)`
  - tipos `ScheduleAgendaResponse` / `ScheduleAppointment` em `[lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`
  - `next build` no frontend

## Loop 38

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX da agenda — pesquisa de `party` sem colar ObjectId (API HTTP + picker na UI)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /parties`, `GET /parties/:id` em `[backend/src/modules/crm/interfaces/party.routes.ts](../../backend/src/modules/crm/interfaces/party.routes.ts)`
  - `PartyRepository.listRecent` em `[party.repository.ts](../../backend/src/modules/crm/infra/party.repository.ts)`
  - `partyRepo` exposto em `[IAppDeps](../../backend/src/config/container.ts)` e registo em `[routes.ts](../../backend/src/app/routes.ts)`
  - testes `[parties-api.integration.test.ts](../../backend/src/__tests__/parties-api.integration.test.ts)`
  - agenda: combobox de contatos + resolução de nomes na tabela em `[schedule/page.tsx](../../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)`; tipo `[CrmParty](../../v0-team-ai-crafter/lib/types/index.ts)`
  - README backend atualizado

## Loop 39

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `POST /parties` + criar contato a partir da UI (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `POST /parties` em `[party.routes.ts](../../backend/src/modules/crm/interfaces/party.routes.ts)`
  - teste de integração em `[parties-api.integration.test.ts](../../backend/src/__tests__/parties-api.integration.test.ts)`
  - componente `[create-party-dialog.tsx](../../v0-team-ai-crafter/components/schedule/create-party-dialog.tsx)` + botões na página `[schedule/page.tsx](../../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)` (toolbar e fluxo “Novo compromisso”)
  - README e plano mestre atualizados

## Loop 40

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: painel leve com métricas derivadas de Prometheus (team-plan / auto-bind) na UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /observability/metrics-summary` em `[observability.routes.ts](../../backend/src/modules/observability/interfaces/observability.routes.ts)` (admin workspace; JSON via `metricsRegistry.getMetricsAsJSON()` filtrado por prefixo `agents_team_crafter_`)
  - testes `[observability-metrics.integration.test.ts](../../backend/src/__tests__/observability-metrics.integration.test.ts)`
  - página `[/observability](../../v0-team-ai-crafter/app/%28app%29/observability/page.tsx)` + entrada na sidebar
  - README backend atualizado

## Loop 41

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` (CRM) + UI mínima na agenda
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `PUT /parties/:id` em `[party.routes.ts](../../backend/src/modules/crm/interfaces/party.routes.ts)` (corpo parcial; 400 se nada aplicável após trim)
  - testes em `[parties-api.integration.test.ts](../../backend/src/__tests__/parties-api.integration.test.ts)`
  - `[edit-party-dialog.tsx](../../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx)` + integração na `[schedule/page.tsx](../../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)` (contatos em cache + botão Editar)
  - README backend atualizado

## Loop 42

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: KPIs legíveis na observabilidade (cards) + campo `kpis` no BFF
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - função pura `[team-plan-metrics-kpis.ts](../../backend/src/modules/observability/application/team-plan-metrics-kpis.ts)` + testes unitários `[team-plan-metrics-kpis.test.ts](../../backend/src/modules/observability/application/team-plan-metrics-kpis.test.ts)`
  - `GET /observability/metrics-summary` passa a incluir `kpis` junto de `metrics` em `[observability.routes.ts](../../backend/src/modules/observability/interfaces/observability.routes.ts)`
  - integração atualizada em `[observability-metrics.integration.test.ts](../../backend/src/__tests__/observability-metrics.integration.test.ts)`
  - UI: cards na `[observability/page.tsx](../../v0-team-ai-crafter/app/%28app%29/observability/page.tsx)`; JSON bruto em secção recolhível; tipos `[TeamPlanMetricsKpis](../../v0-team-ai-crafter/lib/types/index.ts)`
  - README backend atualizado

## Loop 43

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` com `$unset` para limpar `email` / `phone` / `notes` quando enviados vazios (após trim); alinhar `crm_update_party` e UI de edição
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[party.repository.ts](../../backend/src/modules/crm/infra/party.repository.ts)`: `update` com `IPartyUpdateOperation` (`$set` + `$unset`)
  - `[party.routes.ts](../../backend/src/modules/crm/interfaces/party.routes.ts)`: semântica HTTP; corpo `{}` → 400
  - `[register-crm-pack.ts](../../backend/src/modules/crm/application/register-crm-pack.ts)`: `crm_update_party` com a mesma regra para strings opcionais
  - testes em `[parties-api.integration.test.ts](../../backend/src/__tests__/parties-api.integration.test.ts)` (incl. integração `$unset`)
  - `[edit-party-dialog.tsx](../../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx)`: payload sempre com `email`/`phone`/`notes` para permitir limpar campos
  - README backend atualizado

## Loop 44

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: E2E Playwright da rota `/schedule` (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[@playwright/test](../../v0-team-ai-crafter/package.json)` + `[playwright.config.ts](../../v0-team-ai-crafter/playwright.config.ts)`
  - `[e2e/global-setup.ts](../../v0-team-ai-crafter/e2e/global-setup.ts)`: login na API + `storageState` com `localStorage` Zustand (`teamagents-workspace`)
  - `[e2e/schedule.spec.ts](../../v0-team-ai-crafter/e2e/schedule.spec.ts)`: smoke da página (título, Atualizar, Novo compromisso); **skipped** sem `E2E_API_URL` + credenciais (exit 0)
  - `.gitignore` para `e2e/.auth/`; secção no `[README](../../v0-team-ai-crafter/README.md)` com variáveis `E2E_`*

## Loop 45

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: fechar a lacuna de habilitação de tools entre planner, tool definitions e configuração dos agentes
- foco:
  - expor na UI uma jornada clara para **habilitar tools** de workspace nos agentes
  - completar a gestão de `tool-definitions` com edição do estado `enabled`
  - melhorar o AI Builder para deixar explícito quando `requiredPacks` / `requiredTools` são apenas sugestão e quando houve bind real
  - tornar visível o resultado do bind (`boundToolDefinitionIds`) e o caso de agentes `reused`
  - avaliar se a política de auto-bind continua apenas por env ou se precisa de surface configurável no produto
- arquivos-alvo:
  - `v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx`
  - `v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx`
  - `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
  - `v0-team-ai-crafter/lib/types/index.ts`
  - `backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts`
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/config/env.ts`
- critério de saída:
  - um utilizador consegue descobrir, ativar e verificar tools do workspace sem depender de inspeção manual do Mongo ou de leitura do código
  - o fluxo do AI Builder deixa claro quando houve auto-bind e o que ficou pendente de habilitação manual
  - gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx](../../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx)`: gestão de `enabled`, contadores de ativas/desativadas e visibilidade de `internal_action`
  - `[v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx](../../v0-team-ai-crafter/app/%28app%29/agents/%5Bid%5D/page.tsx)`: resumo com contagem de tools do workspace, distinção entre ativas/desativadas e contexto para habilitação manual
  - `[v0-team-ai-crafter/components/agents/agent-details-drawer.tsx](../../v0-team-ai-crafter/components/agents/agent-details-drawer.tsx)`: contagem separada de tools do workspace no resumo rápido
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: diferenciação explícita entre sugestão do planner e bind efetivo, feedback de execução e aviso sobre agentes `reused`
  - decisão do loop: manter a política `TEAM_PLAN_AUTO_BIND_TOOLS` explícita na UI e **ainda** configurada por ambiente, sem introduzir neste slice uma nova surface persistida de workspace

---

# Entregas já concluídas antes da nova frente

- ledger oficial do Ralph Loop
- governança de domínio com overlap guard
- wizard assistido de agentes
- jornada unificada de criação de times
- `runs`, `run_steps` e `run_events`
- grafo coordinator-first
- catálogo inicial de plataforma
- auditoria administrativa
- dashboard e governança
- enforcement warning/blocking
- paginação/export da auditoria
- tendências e SLO
- Redis unificado
- shutdown limpo
- alertas SLO e webhook opcional

---

# Pendências e bloqueios

## Bloqueios

- nenhum bloqueio funcional aberto para iniciar a ETAPA 8

## Dependência principal

O **Loop 17** (foundation) foi entregue no backend: `internal_action`, `BusinessToolRegistry`, `BusinessToolRuntime`, coleção `business_tool_audit`, ação interna `business.ping`, e integração no orquestrador via `businessToolRuntime` em `composeExecutableAgentConfig`.

---

# Estado dos loops do roadmap ativo


| Loop | Tema                                                     | Estado                                                                                         |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 17   | Foundation (`internal_action`, runtime, registry, audit) | entregue                                                                                       |
| 18   | CRM Pack                                                 | entregue (Mongo `Party` + actionIds `crm_`*)                                                   |
| 19   | Care Pack                                                | entregue (`CareSubject` + `care_*`)                                                            |
| 20   | Services & Sales                                         | entregue (catálogo, pedidos, `sales_*` / `service_catalog_*`)                                  |
| 21   | Packages & Encounters                                    | entregue (`PackageSale`, `Encounter`, `package_*`, `attendance_*`)                             |
| 22   | Clinical                                                 | entregue (anamneses, evolução, encontros clínicos + `clinical_*`)                              |
| 23   | Finance                                                  | entregue (`Receivable`, `Payable`, `finance_*`)                                                |
| 24   | Reminders                                                | entregue (`Reminder`, `schedule_*`)                                                            |
| 25   | GitHub Ops                                               | entregue (REST GitHub; requer `GITHUB_TOKEN` / `GH_TOKEN`)                                     |
| 26   | AI Builder / planner                                     | entregue (fase 1: `requiredPacks` / `requiredTools` no planner + persistência)                 |
| 27   | Bind / install de tools a partir do planner              | entregue (`TEAM_PLAN_AUTO_BIND_TOOLS`, fase `binding_tools`, UI revisão)                       |
| 28   | Hardening / testes integração bind                       | entregue (integração + teto 64 actionIds; ver [Loop 28](#loop-28))                             |
| 29   | Observabilidade bind + meta execute + UX truncagem       | entregue (logs, `responseMeta`, toast; ver [Loop 29](#loop-29))                                |
| 30   | Catálogo pack → actionIds + prompt dinâmico              | entregue (ver [Loop 30](#loop-30))                                                             |
| 31   | Labels PT-BR packs (UI) + README backend                 | entregue (ver [Loop 31](#loop-31))                                                             |
| 32   | Prometheus `/metrics` para team-plan execute/bind        | entregue (ver [Loop 32](#loop-32))                                                             |
| 33   | Scheduling / Appointments Pack                           | entregue (ver [Loop 33](#loop-33--scheduling--appointments-pack))                              |
| 34   | Contrato packs ↔ labels                                  | entregue (ver [Loop 34](#loop-34))                                                             |
| 35   | Scheduling: conclusão de appointment → encounter         | entregue (ver [Loop 35](#loop-35))                                                             |
| 36   | Scheduling API HTTP                                      | entregue (ver [Loop 36](#loop-36))                                                             |
| 37   | UI mínima de agenda                                      | entregue (ver [Loop 37](#loop-37))                                                             |
| 38   | Agenda: API parties + picker                             | entregue (ver [Loop 38](#loop-38))                                                             |
| 39   | POST parties + UI criar contato                          | entregue (ver [Loop 39](#loop-39))                                                             |
| 40   | Painel métricas team-plan (UI + BFF)                     | entregue (ver [Loop 40](#loop-40))                                                             |
| 41   | `PUT /parties/:id` + edição na agenda                    | entregue (ver [Loop 41](#loop-41))                                                             |
| 42   | Observabilidade: KPIs + cards na UI                      | entregue (ver [Loop 42](#loop-42))                                                             |
| 43   | CRM: `$unset` em opcionais vazios (`PUT` + tool)         | entregue (ver [Loop 43](#loop-43))                                                             |
| 44   | E2E Playwright `/schedule`                               | entregue (ver [Loop 44](#loop-44))                                                             |
| 45   | Habilitação de tools: UX, tool-definitions e auto-bind   | entregue (UI de ativação + feedback de bind; ver [Loop 45](#loop-45))                          |
| 46   | Política configurável de auto-bind por workspace         | entregue (settings + AI Builder + override no execute; ver [Loop 46](#loop-46))                |
| 47   | Política de bind para agentes `reused`                   | entregue (settings + execute + AI Builder + teste de merge; ver [Loop 47](#loop-47))           |
| 48   | Pré-visualização/aprovação do bind antes do execute      | entregue (preview backend + AI Builder + aprovação antes do execute; ver [Loop 48](#loop-48))  |
| 49   | Overrides granulares do bind por agente                  | entregue (persistência + preview/execute + UI; ver [Loop 49](#loop-49))                        |
| 50   | Ações em lote e reset de overrides do bind               | entregue (ações rápidas globais/por agente/pack + diff final; ver [Loop 50](#loop-50-fechado)) |
| 51   | Ativação inline de tool definitions inativas no preview  | entregue (reativar no execute + `POST .../bind-enable-definitions` + UI; ver [Loop 51](#loop-51-fechado)) |
| 52   | Settings de perfil e preferências com backend real       | entregue (perfil, avatar data URL, prefs, tema; ver [Loop 52](#loop-52-fechado))                |
| 53   | Notificações, canais e explicações operacionais         | entregue (prefs notif. + copy settings/canais; ver [Loop 53](#loop-53-fechado))                 |
| 54   | Segurança e autenticação de conta                        | entregue (senha, revoke sessões, 2FA honesto; ver [Loop 54](#loop-54-fechado))                 |
| 55   | Faturamento, upgrade e enforcement de quotas             | entregue (quotas por plano + UI consumo + upgrade honesto; ver [Loop 55](#loop-55-fechado))      |
| 56   | Templates e tools com curadoria real de produção         | entregue (metadata templates + seed clinica + tools deps; ver [Loop 56](#loop-56-fechado))     |
| 57   | Governança limpa e agenda operacional                    | entregue (purge auditoria + agenda cancelados/delete; ver [Loop 57](#loop-57-fechado))        |
| 58   | Danger Zone administrativa e reset de fábrica            | entregue (ver [Loop 58](#loop-58-fechado))                                                      |
| 59   | Catálogo `internal_action` (presets + API + UI guiada)   | entregue (ver [Loop 59](#loop-59-fechado))                                                      |
| 60   | Remover CRM HTTP do catálogo (ambiguidade vs CRM interno) | entregue (ver [Loop 60](#loop-60-fechado))                                                      |
| 61   | Criação em lote de `internal_action` na página Tools (UX) | entregue (ver [Loop 61](#loop-61-fechado))                                                     |
| 62   | Transparência do fallback do team planner (AI Builder)   | entregue (ver [Loop 62](#loop-62-fechado))                                                     |
| 63   | Paridade planner × canais (Chat SDK + nativos)             | entregue (ver [Loop 63](#loop-63-fechado))                                                     |
| 64   | Builtins por domínio (criação de time e AI Builder)        | entregue (ver [Loop 64](#loop-64-fechado))                                                      |
| 65   | Foundation responsiva multi-device                         | entregue (ver [Loop 65](#loop-65-fechado))                                                      |
| 66   | Responsividade das telas críticas                          | entregue (ver [Loop 66](#loop-66-fechado))                                                      |
| 67   | Onboarding contextual e tour por tela                      | entregue (ver [Loop 67](#loop-67-fechado))                                                      |
| 68   | Expansão de tours contextuais (listagens)                    | entregue (ver [Loop 68](#loop-68-fechado))                                                      |
| 69   | Tours contextuais — governança e observabilidade             | entregue (ver [Loop 69](#loop-69-fechado))                                                      |
| 70   | Tours contextuais — fichas agente e time                     | entregue (ver [Loop 70](#loop-70-fechado))                                                      |
| 71   | Tabelas densas — scroll horizontal (`ResponsiveTableScroll`) | entregue (ver [Loop 71](#loop-71-fechado))                                                      |
| 72   | Tours — spotlight / ancoragem DOM (opcional por passo)       | entregue (ver [Loop 72](#loop-72-fechado))                                                      |
| 73   | Listagens densas — vista em cards (mobile/tablet)             | entregue (ver [Loop 73](#loop-73-fechado))                                                      |
| 74   | Listagens densas — cards em `/governance`                     | entregue (ver [Loop 74](#loop-74-fechado))                                                      |
| 75   | Listagens densas — cards em `/tool-definitions`              | entregue (ver [Loop 75](#loop-75-fechado))                                                      |
| 76   | Listagens densas — cards em `/templates`                     | entregue (ver [Loop 76](#loop-76-fechado))                                                      |
| 77   | Prompts do planner — domínio, builtin e anti-duplicação       | entregue (ver [Loop 77](#loop-77-fechado))                                                      |
| 78   | Enforcement / UX — builtins de negócio sem ambiguidade       | entregue (ver [Loop 78](#loop-78-fechado))                        |
| 79   | AI Builder — atalhos por agente com definition inativa (bind preview) | entregue (ver [Loop 79](#loop-79-fechado))                        |
| 80   | Planner — matriz pré-JSON + outer loop auto-reparo IA (unicidade builtins) | entregue (ver [Loop 80](#loop-80-fechado)) |
| 81   | AI Builder — preview simples, tools focalizadas, camadas (UX assistido) | entregue (ver [Loop 81](#loop-81-fechado)) |
| 82   | Contrato do planner por agente + workflow ownership | entregue (ver [Loop 82](#loop-82-fechado)) |
| 83   | Bind preview e execute per-agent (fim do bind global) | entregue (ver [Loop 83](#loop-83-fechado)) |
| 84   | Built-ins mínimas por papel + hints por packs | entregue (ver [Loop 84](#loop-84-fechado)) |
| 85   | UX AI Builder — preview estável e execute fluido | entregue (ver [Loop 85](#loop-85-fechado)) |
| 86   | AI Builder — execute, bind review proporcional, workflow ownership explícito | entregue (ver [Loop 86](#loop-86-fechado)) |
| 87   | Especialistas operacionais — schemas reais, slot-filling, CRM, contexto conversacional (debug) | entregue (ver [Loop 87 fechado](#loop-87-fechado)) |
| 88   | Readiness / preflight operacional do time (`ready` / `attention` / `blocked`) | entregue (ver [Loop 88 fechado](#loop-88-fechado)) |
| 89   | AI Builder — modo simples vs avançado (progressive disclosure, bind) | entregue (ver [Loop 89 fechado](#loop-89-fechado)) |
| 90   | Cockpit operacional na ficha do time (última run, canais, prioridades, atalhos) | entregue (ver [Loop 90 fechado](#loop-90-fechado)) |


**Gate entre loops:** `./scripts/ralph-loop-gate.sh` (backend build + testes; opcional `RALPH_LOOP_INCLUDE_FRONTEND=1` para Next). E2E: `v0-team-ai-crafter` → `npm run test:e2e` (skipped sem `E2E_`*; não entra no gate por defeito).

---

# Próximo loop oficial

**Último slice oficial fechado:** **[Loop 98.9](#loop-989-fechado--regressão-mínima-por-pack)** — regressão mínima por pack com cenário feliz por vertical prioritária.

**Penúltimo slice fechado:** **[Loop 98.8](#loop-988-fechado--debug-conversacional-e-ux-de-incidente)** — debug conversacional e UX de incidente.

**Próximo slice oficial (aberto):** **Loops 96+ por vertical de pack** — priorizar domínio e numerar o próximo ciclo (ex.: care/finance/scheduling). Mantém-se [Loop 95](#loop-95-candidato--polimento-ui-padrão-e-responsivo-da-operação) como candidato de UX operacional.

| Ordem | Tema | Plano mestre / anexo |
| --- | --- | --- |
| **1** | **Loop 87** — especialistas operacionais *(fechado)* | [plano §87](agents-team-crafter-plano-evolucao.md#loop-87-especialistas-operacionais-schemas-reais-coleta-de-dados-faltantes-e-contexto-conversacional), [anexo](ralph-loop-87-especialistas-operacionais.md), [ledger](#loop-87-fechado) |
| **2** | **Loop 88** — readiness / preflight *(fechado)* | [plano §88](agents-team-crafter-plano-evolucao.md#loop-88--preflight-operacional-do-team--readiness-do-runtime), [ledger](#loop-88-fechado) |
| **3** | **Loop 89** — AI Builder simples / avançado *(fechado)* | [plano §89](agents-team-crafter-plano-evolucao.md#loop-89--ai-builder-com-modo-simples-por-defeito-e-avançado-sob-demanda), [ledger](#loop-89-fechado) |
| **4** | **Loop 90** — cockpit na ficha do time *(fechado)* | [plano §90](agents-team-crafter-plano-evolucao.md#loop-90--cockpit-operacional-do-team), [ledger](#loop-90-fechado) |
| **5** | **Loop 91** — console debug com sessões *(fechado)* | [plano §91](agents-team-crafter-plano-evolucao.md#loop-91--console-conversacional-com-sessões-timeline-e-contexto-reutilizável), [ledger](#loop-91-fechado) |
| **6** | **Loop 92** — CTAs no readiness *(fechado)* | [plano §92](agents-team-crafter-plano-evolucao.md#loop-92--resolver-pendências-com-cta-directo), [ledger](#loop-92-fechado) |
| **7** | **Loop 93** — runs legíveis / troubleshooting *(fechado)* | [plano §93](agents-team-crafter-plano-evolucao.md#loop-93--runs-legíveis-replay-e-troubleshooting-rápido), [ledger](#loop-93-fechado) |
| **8** | **Loop 94** — templates operacionais / cenários dourados *(fechado)* | [plano §94](agents-team-crafter-plano-evolucao.md#loop-94--templates-operacionais-e-cenários-dourados-de-validação), [ledger](#loop-94-fechado) |
| **9** | **Loop 95** — polimento UI operacional *(candidato)* | [plano §95](agents-team-crafter-plano-evolucao.md#loop-95--polimento-final-de-ui-padrão-e-responsiva-para-operação); [tabela ledger](#backlog-recomendado-após-o-loop-87) |
| **10** | **Loop 98.1** — norma oficial de contrato de tools *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.1](#loop-981-fechado--norma-oficial-de-contrato-de-tools) |
| **11** | **Loop 98.2** — pipeline canónico do boundary *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.2](#loop-982-fechado--pipeline-canónico-do-boundary-da-tool) |
| **12** | **Loop 98.3** — observabilidade obrigatória *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.3](#loop-983-fechado--observabilidade-obrigatória-do-contrato) |
| **13** | **Loop 98.4** — retry seguro e limitado *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.4](#loop-984-fechado--retry-seguro-e-limitado) |
| **14** | **Loop 98.5** — contrato explícito de prompts *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.5](#loop-985-fechado--contrato-explícito-de-prompts-alinhado-ao-runtime) |
| **15** | **Loop 98.6** — biblioteca de normalização por `actionId` *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.6](#loop-986-fechado--biblioteca-de-normalização-por-actionid) |
| **16** | **Loop 98.7** — matriz de segurança por `actionId` *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.7](#loop-987-fechado--matriz-de-segurança-por-actionid) |
| **17** | **Loop 98.8** — debug conversacional e UX de incidente *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.8](#loop-988-fechado--debug-conversacional-e-ux-de-incidente) |
| **18** | **Loop 98.9** — regressão por pack *(fechado)* | [anexo Loop 98](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md), [ledger §Loop 98.9](#loop-989-fechado--regressão-mínima-por-pack) |
| **19+** | **Loops 96+** — verticais por pack *(oficial, em aberto)* | [plano §96+](agents-team-crafter-plano-evolucao.md#loops-88-mais-verticais-de-negócio-por-pack) — candidatos (`care`, `finance`, `scheduling`, …); numerar a partir de 96 ao abrir cada slice |
| *(14.8)* | Billing / 2FA / self-service | [14.8](agents-team-crafter-plano-evolucao.md#148-riscos-e-decisões-em-aberto) |

**Norma de domínio / builtins:** [§2.6](agents-team-crafter-plano-evolucao.md#sec-selecao-ferramentas-dominio), [micro-etapas A–K](#micro-etapas-ralph-criacao-times-ia); enforcement manual [Loop 78](#loop-78-fechado); reparo no `POST` do planner [Loop 80](#loop-80-fechado); UX preview [Loop 81](#loop-81-fechado) (*entregue*).

**Regra Ralph:** um slice coerente por ciclo; fechar com gate (`./scripts/ralph-loop-gate.sh`, com `RALPH_LOOP_INCLUDE_FRONTEND=1` se tocar no Next), commit + push, depois atualizar tabela acima e a secção **Loop N (fechado)** abaixo.

---

<a id="checklist-do-loop-82-fechado"></a>

## Checklist do Loop 82 (fechado)

- [x] Evoluir `plannerOutputSchema` por agente (Zod) em [`team-plan-planner-output.schema.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.ts)
- [x] Introduzir `workflowKey` por agente com unicidade entre especialistas ([`planner-workflow-ownership.ts`](../../backend/src/modules/team-planning/domain/planner-workflow-ownership.ts))
- [x] Introduzir `requiredBusinessActionIds` e `requiredPackIds` por agente
- [x] Alinhar [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts) e reparo Loop 80 (payload JSON)
- [x] Tipos frontend em [`v0-team-ai-crafter/lib/types/index.ts`](../../v0-team-ai-crafter/lib/types/index.ts) + cartão no [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)
- [x] Persistência Mongoose [`team-plan.model.ts`](../../backend/src/modules/team-planning/infra/team-plan.model.ts); `buildFallback` + `agentGraphData` em [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts)
- [x] Testes: `team-plan-planner-output.schema.test.ts`, `planner-workflow-ownership.test.ts`, `planner-agent-catalog-tools.test.ts`
- [x] Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **227** testes backend; `next build` OK

<a id="checklist-do-loop-83-fechado"></a>

## Checklist do Loop 83 (fechado)

- [x] `buildBindPreview` / `executePlan`: candidatos por agente quando `hasPerAgentBindHints` (listas por agente); legado global inalterado
- [x] [`planner-pack-presets.ts`](../../backend/src/modules/team-planning/application/planner-pack-presets.ts): `computePlannerBindActionUniverse`, `mergePlannerPackIdsForBind`, testes Loop 83
- [x] AI Builder: badge **por agente** + copy quando `bindResolutionMode === per_agent`
- [x] Tipos `TeamPlanBindPreview.bindResolutionMode`
- [x] `normalizeBindOverrides` em `updatePlan` / `updateBindOverrides` com universo capped alinhado
- [x] Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **232** testes backend; `next build` OK

<a id="checklist-do-loop-84-fechado"></a>

## Checklist do Loop 84 (fechado)

- [x] [`planner-agent-catalog-tools.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts): removida rotação por índice; `inferCatalogPackContextLower`; hints por packs (`calendar_access`, `internal_actions`) conservadores
- [x] [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts): regra Loop 84 (inferência mínima; sem rotação)
- [x] Testes: [`planner-agent-catalog-tools.test.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.test.ts), [`team-plan-planner-prompt.test.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.test.ts)
- [x] Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **237** testes backend; `next build` OK

<a id="checklist-do-loop-85-fechado"></a>

## Checklist do Loop 85 (fechado)

- [x] [`team-plan-bind-fingerprint.ts`](../../v0-team-ai-crafter/lib/team-plan-bind-fingerprint.ts): `teamPlanBindFingerprint`, `planHasBindReviewHints`
- [x] [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx): `proposePlanUpdate` — invalida preview/aprovação só quando o fingerprint de bind muda; edições cosméticas e `catalogTools` não limpam o preview
- [x] `requiresBindReview` / contagens incluem `requiredBusinessActionIds` / `requiredPackIds` por agente; alerta “Capabilities sugeridas” coerente
- [x] `saveEdits` mantém o preview até o novo `bind-preview` regressar do servidor
- [x] Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **237** testes; `next build` OK

---

# Checklist do Loop 27 (fechado)

- ADR ou nota curta: política de auto-criação vs só sugestão (`requiredTools` / `requiredPacks`) → `[docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md](../adr/ADR-2026-04-team-plan-auto-bind-tools.md)`
- Backend: criar ou reutilizar `WorkspaceToolDefinition` (`internal_action` + `actionId`) por workspace
- Backend: em `execute` do team plan, aplicar `customToolDefinitionIds` aos agentes novos quando `TEAM_PLAN_AUTO_BIND_TOOLS=1`
- Frontend: revisão de packs/capabilities sugeridas no fluxo AI create team (mínimo viável)
- Testes: `planner-pack-presets.test.ts` + suite existente
- Gate: build + testes (`153` testes) e `next build` no frontend
- Ledger: este ficheiro atualizado

---

# Checklist do Loop 28 (fechado)

- Integração: execute com `TEAM_PLAN_AUTO_BIND_TOOLS=1` e plano com `requiredTools` → agentes com `customToolDefinitionIds` → `[team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`
- Limite de actionIds por execução (proteção abuso): teto **64** em `team-plan.service.ts` antes de `ensureInternalActionDefinitions`
- Idempotência: segundo `execute` com mesmo `operationId` coberto no teste de integração
- Gate: build + testes (`155` testes)
- Ledger: este ficheiro atualizado

---

# Checklist do Loop 29 (fechado)

- Logs estruturados no bind (`team_plan.auto_bind_summary` / truncagem) com `correlationId`
- `responseMeta`: `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated`
- Auditoria: payload com `autoBindActionsRequested` / `autoBindActionsTruncated`
- Frontend: tipo `TeamPlanExecuteMeta` + toast quando lista truncada
- ADR atualizado
- Teste de integração asserta os novos campos de meta
- Gate: backend `155` testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 30 (fechado)

- Ampliar `PLANNER_PACK_TO_ACTION_IDS` com actionIds já registados no registry
- Export `PLANNER_PACK_IDS` + prompt do planner alinhado (lista dinâmica)
- Testes: invariante de chaves + expansão `finance`
- Gate: backend **157** testes

---

# Checklist do Loop 31 (fechado)

- UX: rótulos PT-BR para `requiredPacks` no AI Builder (`planner-pack-labels.ts` + `title` com id técnico)
- Docs: secção no `[backend/README.md](../../backend/README.md)` com pointers ao preset, prompt e ADR
- Gate: backend **157** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 32 (fechado)

- Adicionar `prom-client` ao backend
- Expor `GET /metrics` com registry singleton e default metrics
- Instrumentar `team-plan execute` e auto-bind com counters/histograms
- Teste de integração cobre `/metrics`
- Docs: README backend atualizado
- Gate: backend **157** testes

---

# Checklist do Loop 33 (fechado)

- Criar `appointments` e `availability_slots`
- Registrar actions iniciais de agenda no `BusinessToolRegistry`
- Integrar o pack com `service_orders`, `package_sales`, `encounters` e `reminders` no mínimo viável
- Atualizar planner/presets para o pack `scheduling`
- Gate: backend **160** testes + `v0-team-ai-crafter` build
- Ledger atualizado

---

# Checklist do Loop 34 (fechado)

- Garantir contrato entre `PLANNER_PACK_IDS` e `PLANNER_PACK_LABELS_PT`
- Gate: backend **161** testes
- Ledger atualizado

---

# Checklist do Loop 35 (fechado)

- Expandir `scheduling` com `schedule_complete_appointment`
- Criar `encounter` ao concluir appointment e vincular `careSubjectId`
- Marcar reminder associado como `done`
- Atualizar preset do pack `scheduling`
- Gate: backend **162** testes

---

# Checklist do Loop 36 (fechado)

- Expor Scheduling API autenticada em `/api/v1/schedule/...`
- Reaproveitar regras do `BusinessToolRegistry` sem duplicar a lógica de negócio
- Cobrir agenda diária e conclusão de appointment via teste de integração
- Docs: `backend/README.md` + plano mestre atualizados
- Gate: backend **164** testes

---

# Checklist do Loop 37 (fechado)

- Rota `/schedule` com vista diária e `GET /schedule/agenda`
- Ações operacionais nos compromissos (confirmar, cancelar, falta, concluir)
- Criação de compromisso e de janela de disponibilidade via API
- Sidebar + tipos TypeScript
- Gate: `v0-team-ai-crafter` `npm run build`

---

# Checklist do Loop 38 (fechado)

- API HTTP `GET /parties` (lista recente + `q`) e `GET /parties/:id`
- Picker na criação de compromisso + fallback ID manual
- Nomes de contato na tabela de compromissos (lookup por id)
- Gate: backend **168** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 39 (fechado)

- `POST /parties` com validação Zod
- UI: diálogo “Novo contato” na toolbar e atalho no “Novo compromisso”
- Teste de integração POST + GET por id
- Gate: backend **169** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 40 (fechado)

- BFF: `GET /observability/metrics-summary` + RBAC admin
- UI: rota `/observability` com JSON das séries team-plan
- Testes de integração admin vs membro
- Gate: backend **171** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 41 (fechado)

- `PUT /parties/:id` com validação e 400 quando patch vazio
- UI: `EditPartyDialog` na lista de compromissos + cache `partiesById`
- Testes de integração PUT + caso 400
- Gate: backend **173** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 42 (fechado)

- BFF: `kpis` agregados em `GET /observability/metrics-summary` (`computeTeamPlanMetricsKpis`)
- Testes: unitários `team-plan-metrics-kpis.test.ts` + integração asserta `kpis`
- UI: cards (execuções, duração, auto-bind) + JSON em collapsible
- Gate: backend **175** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 43 (fechado)

- Repositório: `IPartyUpdateOperation` com `$set` / `$unset` para `email`, `phone`, `notes`
- Rotas HTTP + `crm_update_party` alinhados; integração cobre limpeza e 400 em `{}`
- UI: `EditPartyDialog` envia strings opcionais para permitir limpar
- Gate: backend **176** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 44 (fechado)

- Playwright + config + `e2e/global-setup.ts` (login API → `storageState` com Zustand)
- `e2e/schedule.spec.ts` smoke; sem `E2E_`* → testes skipped (exit 0)
- README frontend com comandos e variáveis; `e2e/.auth/` no `.gitignore`
- Gate: backend **176** testes + `v0-team-ai-crafter` build + `npm run test:e2e` (skipped)

---

# Checklist do Loop 45 (fechado)

- UI: permitir gerir `enabled` em `tool-definitions`
- UI: tornar explícita a habilitação manual de tools de workspace na página do agente
- UI: AI Builder mostrar com clareza sugestão vs bind efetivo (`boundToolDefinitionIds`, auto-bind ligado/desligado, agentes `reused`)
- Backend/produto: decidir e documentar a política de habilitação do auto-bind (mantido por env neste loop; UI explicitada)
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 46

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: expor uma política configurável de auto-bind por workspace, reduzindo dependência operacional de env
- foco:
  - definir se a política vive em `settings`, governança ou configuração própria do planner
  - permitir leitura/escrita da política via produto, mantendo compatibilidade com `TEAM_PLAN_AUTO_BIND_TOOLS`
  - decidir se agentes `reused` continuam fora do bind automático ou se passam a ter política controlada
  - refletir a política visível no AI Builder e nos metadados de execução
- critério de saída:
  - um admin consegue controlar a política sem editar ambiente do servidor
  - a decisão fica documentada e coberta por testes mínimos
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts](../../backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts)`: política resolvida (`inherit` / `enabled` / `disabled`) com fallback para `TEAM_PLAN_AUTO_BIND_TOOLS`
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../../backend/src/modules/settings/interfaces/settings.routes.ts)`: endpoints `GET` / `PUT /settings/workspace/team-planning-policy`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: `executePlan` passa a usar a política do workspace e expor `autoBindPolicySource` / `autoBindMode`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/%28app%29/settings/page.tsx)`: UI para admin controlar a política no produto
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: AI Builder mostra a política efetiva do workspace antes e depois do execute
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura da sobreposição por workspace com env global desligada

---

## Loop 46 (fechado)

- Backend: resolver política híbrida (`workspace` + fallback env) para auto-bind
- Backend: expor leitura/escrita da política por endpoint dedicado em `settings`
- Frontend: permitir a um admin ajustar a política em Configurações
- Frontend: AI Builder mostrar a política efetiva antes e depois da execução
- Testes: integração cobrindo override de workspace com env global desligada
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 47

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: decidir e implementar a política de bind para agentes `reused`, fechando a última ambiguidade principal do execute do team plan
- foco:
  - decidir se agentes `reused` continuam excluídos do bind ou se passam a receber merge controlado de `customToolDefinitionIds`
  - se houver bind em `reused`, definir guardrails de segurança e visibilidade na UI
  - alinhar `responseMeta`, auditoria e AI Builder para explicitar o comportamento escolhido
  - cobrir o comportamento com testes de integração
- critério de saída:
  - a política para agentes `reused` fica explícita no produto e no código
  - o comportamento fica coberto por testes e documentado no ledger
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts](../../backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts)`: política híbrida passa a incluir `reusedAgentBindMode` (`manual` / `merge`) com default seguro em `manual`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: `executePlan` respeita a política para agentes `reused` e expõe `reusedAgentBindMode`, `reusedAgentsUpdated` e `reusedAgentsSkipped`
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../../backend/src/modules/settings/interfaces/settings.routes.ts)`: `PUT /settings/workspace/team-planning-policy` persiste também a política de `reused`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura do caso `reusedAgentBindMode=merge` com agente reutilizado recebendo `customToolDefinitionIds`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/%28app%29/settings/page.tsx)`: Configurações expõem a decisão entre modo manual e merge controlado
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: AI Builder mostra a política efetiva para `reused` antes e depois da execução
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: meta do execute tipada com os novos campos de política e contadores

---

## Loop 47 (fechado)

- Backend: tornar explícita a política de bind para agentes `reused`
- Backend: aplicar `merge` controlado quando configurado no workspace
- Backend: expor metadados/auditoria do bind em `reused`
- Frontend: permitir configurar a política em Configurações
- Frontend: AI Builder explicar a política e o resultado por agentes reutilizados
- Testes: integração cobrindo `reusedAgentBindMode=merge`
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 48

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: dar previsibilidade operacional ao bind antes do execute, mostrando exatamente o que será associado a cada agente
- foco:
  - gerar preview por agente com separação entre `new` e `reused`
  - explicitar quais `WorkspaceToolDefinition` serão criadas, reutilizadas ou apenas vinculadas
  - permitir aprovação consciente do merge em agentes `reused` antes de executar
  - alinhar preview, `responseMeta` e feedback do AI Builder
- critério de saída:
  - o usuário entende antes do execute quais binds serão aplicados
  - a divergência entre sugestão do planner e efeito real do runtime fica mínima
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: helper único de preview para espelhar a lógica efetiva do `execute`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: endpoint `GET /team-plans/:id/bind-preview`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura do preview por agente antes do execute
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview de bind
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: card de preview, refresh manual e aprovação obrigatória antes do execute

---

## Loop 48 (fechado)

- Backend: expor preview do bind por plano antes do execute
- Backend: reaproveitar a mesma regra do execute para evitar divergência preview/runtime
- Frontend: mostrar preview de tool definitions e impacto por agente
- Frontend: exigir aprovação explícita do preview antes do execute quando houver capabilities sugeridas
- Testes: integração cobrindo o endpoint de preview
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 49

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: permitir override granular do bind no AI Builder, para o usuário ajustar o plano antes da execução final
- foco:
  - permitir ligar/desligar o bind por agente no preview
  - permitir excluir actionIds específicas antes do execute sem editar manualmente o plano bruto
  - persistir os overrides no `team-plan` ou no request de execute com rastreabilidade
  - refletir os overrides em `responseMeta`, auditoria e feedback final do execute
- critério de saída:
  - o usuário consegue revisar e ajustar o bind sem sair do AI Builder
  - o runtime executa exatamente o conjunto aprovado no preview
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/infra/team-plan.model.ts](../../backend/src/modules/team-planning/infra/team-plan.model.ts)` e `[team-plan.repository.ts](../../backend/src/modules/team-planning/infra/team-plan.repository.ts)`: persistência de `bindOverrides` no `team-plan`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: endpoint `PUT /team-plans/:id/bind-overrides`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: preview/execute passam a respeitar overrides por agente e por `actionId`, com auditoria e `responseMeta` alinhados
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura de override granular para desligar binds, remover `actionIds` e forçar bind em agente `reused`
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: toggles por agente, checkboxes por `actionId` e persistência imediata dos overrides no preview
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview/meta/`TeamPlanDraft` alinhados ao novo contrato

---

## Loop 49 (fechado)

- Backend: persistir `bindOverrides` no `team-plan`
- Backend: permitir salvar overrides via endpoint dedicado e reaproveitar o mesmo contrato no preview e no execute
- Backend: alinhar auditoria e `responseMeta` aos overrides efetivamente aplicados
- Frontend: permitir ligar/desligar bind por agente no preview
- Frontend: permitir retirar `actionIds` específicas antes do execute
- Testes: integração cobrindo cenários `disabled`, exclusão de `actionId` e override `enabled` para agente `reused`
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (`181` testes backend + build frontend)

---

## Loop 50 (fechado)

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: reduzir atrito operacional dos overrides com ações em lote e uma leitura final mais clara do delta aprovado
- foco:
  - adicionar ações rápidas de “aplicar tudo”, “limpar tudo” e “resetar para a política do workspace”
  - permitir operar overrides em lote por agente e por pack sugerido
  - mostrar no preview um diff compacto entre política padrão, overrides salvos e bind final que será executado
  - refletir o delta aprovado no feedback final do execute
- critério de saída:
  - o usuário consegue ajustar cenários com muitas capabilities sem microgerenciar checkbox a checkbox
  - o preview final deixa explícito o delta entre padrão do workspace e decisão aprovada
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: preview enriquecido com `packIds` por action, `defaultActionIdsToLink`, `suggestedPacks` e `diffSummary`; `responseMeta` / auditoria passam a espelhar o delta final aprovado
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura de preview com `requiredPacks`, diff agregado e meta final do execute
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: ações rápidas globais, por agente e por pack; diff final compacto; badges de pack nas tool definitions; feedback final alinhado ao delta aprovado
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview/meta atualizados para packs e diff do bind

---

## Loop 51 (fechado)

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: fechar o último atrito operacional do bind quando o preview encontra `tool definitions` existentes, porém inativas
- foco:
  - permitir ativar `internal_action` inativas diretamente a partir do preview do bind, sem sair do AI Builder
  - distinguir com clareza o que depende de criação, reuso ou apenas reativação de definition
  - refletir na UI e no `responseMeta` quando uma definition foi reativada para destravar o bind
  - reduzir a ida e volta entre o AI Builder e a página de `tool-definitions`
- critério de saída:
  - o utilizador consegue resolver o caso “definition existe mas está inativa” sem abandonar o fluxo de criação do time
  - o preview continua espelhando com precisão o resultado final do runtime após a reativação
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../../backend/src/modules/team-planning/application/team-plan.service.ts)`: `plannedOperation` `reactivate`; reativação no `execute`; `enableDisabledBindDefinitions` + preview reconstruído; `responseMeta.reactivatedToolDefinitionIds`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: `POST /team-plans/:id/bind-enable-definitions`
  - `[backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts](../../backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts)`: `PUT` aceita `enabled`
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: botões “Ativar no workspace” / lote; meta pós-execução
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: tipos `reactivate` / `reactivatedToolDefinitionIds`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: `describe` isolado “Loop 51” (execute + endpoint)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 52 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: fechar o gap entre o que `/settings` mostra e o que realmente persiste para o utilizador
- foco:
  - foto/avatar de perfil real
  - idioma persistido em `preferences`
  - tema persistido em `preferences` e respeitado no app shell
  - bio e preferências explícitas ou remoção da UI sem backend
  - navegação correta de `Meu Perfil` no menu superior
- critério de saída:
  - tudo o que aparece em perfil/preferências salva de verdade ou deixa de ser exibido como funcional
- **entregue no repositório:**
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../../backend/src/modules/settings/interfaces/settings.routes.ts)`: `PUT /settings/profile` aceita `avatar` (data URL), devolve perfil completo; removido `POST /settings/profile/avatar` que não persistia ficheiro
  - `[backend/src/modules/users/infra/user.repository.ts](../../backend/src/modules/users/infra/user.repository.ts)`: `updateProfile` com `$unset` para limpar `avatar`
  - `[backend/src/modules/auth/interfaces/auth.routes.ts](../../backend/src/modules/auth/interfaces/auth.routes.ts)`: `preferences` em login/register/`GET /auth/me`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: tab `?tab=profile`, bio/locale/tema persistidos, email só leitura, upload de avatar
  - `[v0-team-ai-crafter/components/providers/app-providers.tsx](../../v0-team-ai-crafter/components/providers/app-providers.tsx)` + `[user-preferences-sync.tsx](../../v0-team-ai-crafter/components/layout/user-preferences-sync.tsx)`: `next-themes` no shell + sync tema/idioma
  - `[v0-team-ai-crafter/components/layout/app-header.tsx](../../v0-team-ai-crafter/components/layout/app-header.tsx)`: avatar + `Meu Perfil` → `/settings?tab=profile`
  - `[v0-team-ai-crafter/app/layout.tsx](../../v0-team-ai-crafter/app/layout.tsx)`: `suppressHydrationWarning`, sem `className="dark"` fixo no `<html>`
  - `[backend/src/__tests__/auth.integration.test.ts](../../backend/src/__tests__/auth.integration.test.ts)`: cobertura de perfil e limpeza de avatar
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 53 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: tornar `/settings` e `/channels` mais compreensíveis e utilizáveis em produção
- foco:
  - persistência real de preferências de notificação
  - canal adicional de notificação via Discord, se alinhado ao modelo de canais existente
  - explicação prática de OpenAI, `API keys`, integrações e tools de catálogo
  - redução da ambiguidade entre `Chat SDK — plataformas` e `Canais genéricos`
- critério de saída:
  - o utilizador entende para que serve cada configuração e consegue testá-la com poucos cliques
- **entregue no repositório:**
  - `[v0-team-ai-crafter/lib/types/index.ts](../../v0-team-ai-crafter/lib/types/index.ts)`: `IUserNotificationPreferences` + `notifications` em `IUserPreferences`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: aba Notificações com `user.preferences.notifications` persistido; botão **Guardar notificacoes** (`PUT` parcial); toggles email / Slack / Discord + tipos; alertas explicativos; texto para Chaves de API e **Leitura rapida** em Integrações
  - `[v0-team-ai-crafter/app/(app)/channels/page.tsx](../../v0-team-ai-crafter/app/(app)/channels/page.tsx)`: alerta *Chat SDK vs canais genéricos*, descrições alinhadas ao modelo existente (Discord já em `CHAT_SDK_PLATFORMS`), links para settings
  - `[backend/src/__tests__/auth.integration.test.ts](../../backend/src/__tests__/auth.integration.test.ts)`: merge de `preferences.notifications`
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 54 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: entregar o mínimo de segurança de conta esperado para produção
- foco:
  - alterar senha
  - gestão mínima de sessões
  - decisão honesta sobre 2FA: implementar MVP ou ocultar CTA até existir backend real
  - alinhar a danger zone de conta com ações reais
- critério de saída:
  - não existir mais botão crítico de segurança sem endpoint correspondente
- **entregue no repositório:**
  - `[backend/src/modules/auth/interfaces/auth.routes.ts](../../backend/src/modules/auth/interfaces/auth.routes.ts)`: `POST /auth/change-password`, `POST /auth/revoke-sessions`; `GET /auth/me` inclui `session.hasRefreshToken`
  - `[backend/src/modules/users/infra/user.repository.ts](../../backend/src/modules/users/infra/user.repository.ts)`: `updatePasswordHash` (invalida refresh)
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: dialog alterar senha; sessão/renovação honesta; 2FA como indisponível; remover exclusão de conta falsa
  - `[backend/src/__tests__/auth.integration.test.ts](../../backend/src/__tests__/auth.integration.test.ts)`: alteração de senha e revoke
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 55 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: fazer o plano Free / Pro / Enterprise refletir comportamento real do backend
- critério de saída: limites por plano aplicados no servidor; UI mostra consumo real; upgrade sem checkout falso
- **Plano Free — quotas canónicas (fonte Ralph Loop; alinhar copy e enforcement):** 1 time · até 5 agentes no workspace · 1 canal.

| Dimensão | Limite |
| --- | ---: |
| Times | 1 |
| Agentes | 5 |
| Canais | 1 |

- **entregue no repositório:**
  - `[backend/src/modules/workspaces/application/workspace-plan-limits.ts](../../backend/src/modules/workspaces/application/workspace-plan-limits.ts)`: defaults por plano (free: **1 / 5 / 1**; pro: 10 / 50 / 50; enterprise: ilimitado); `assertWorkspaceQuota` / `assertWorkspaceQuotaDelta`; erro `QUOTA_EXCEEDED` (403)
  - `[backend/src/modules/settings/infra/settings.repository.ts](../../backend/src/modules/settings/infra/settings.repository.ts)`: `getWorkspace` agrega `max*` efectivos (override em `workspace.limits` quando definido)
  - Rotas: `POST /teams`, `POST /teams/:id/duplicate`, `POST /agents`, `POST /channels`; `team-plan.execute` e `agent-plan.execute` respeitam quotas antes de criar recursos
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: separador Faturamento com `used/max` ou ilimitado; alerta sobre ausência de gateway; dialog “Fazer upgrade” com email e workspace id (sem cartão fictício)
  - `[backend/src/__tests__/workspace-quota.integration.test.ts](../../backend/src/__tests__/workspace-quota.integration.test.ts)`: cobertura GET limits + bloqueio teams/agents/channels
  - Testes de team-plan com workspace `enterprise` onde o fluxo cria muitos recursos (`team-plan-auto-bind`, `team-plans`) para não colidir com quotas de teste
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 56 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: fazer `Templates` e `Tools` entregarem valor concreto para uso produtivo
- critério de saída: templates seed honestos + vertical saude; UI mostra requisitos antes de aplicar; tools explicam dependências
- **entregue no repositório:**
  - `[backend/src/modules/templates/infra/template.model.ts](../../backend/src/modules/templates/infra/template.model.ts)`: `vertical`, `prerequisites[]`, `applyBehavior`
  - `[backend/src/modules/templates/infra/template.repository.ts](../../backend/src/modules/templates/infra/template.repository.ts)`: expõe campos em listagem e `GET /templates/:id`
  - `[backend/scripts/seed-demo.ts](../../backend/scripts/seed-demo.ts)`: template omnichannel corrigido (sem prometer 4 agentes inexistentes); novo agente `Especialista Saude Mental`; template **Clinica Psicologia — triagem**; copy honesta nos três templates
  - `[v0-team-ai-crafter/app/(app)/templates/page.tsx](../../v0-team-ai-crafter/app/(app)/templates/page.tsx)`: modal com requisitos, comportamento real e agentes referenciados (`GET` detalhe)
  - `[v0-team-ai-crafter/components/templates/template-card.tsx](../../v0-team-ai-crafter/components/templates/template-card.tsx)`: vertical + primeiro requisito; label "no modelo"
  - `[v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx](../../v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx)`: tipos de tool no cabeçalho; dependências por `kind`; link para Integrações
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 57 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: fechar pendências operacionais que impactam uso diário e administração
- critério de saída: limpar auditoria e remover compromissos terminais sem Mongo shell
- **entregue no repositório:**
  - Agenda: `GET /schedule/agenda?includeCancelled=false` omite cancelados da lista; `DELETE /schedule/appointments/:id` (admin) remove definitivamente `cancelled` / `no_show`; acção `schedule_delete_appointment` + `AppointmentRepository.hardDelete`
  - `[v0-team-ai-crafter/app/(app)/schedule/page.tsx](../../v0-team-ai-crafter/app/(app)/schedule/page.tsx)`: interruptor “Mostrar cancelados”; botão “Remover da base” com confirmação
  - Governança: `POST /governance/audit-events/purge` com `confirmPhrase: PURGE_GOVERNANCE_AUDIT` e `scope: all | range`; `GovernanceAuditEventRepository.purge`; evento `governance.audit_purged` após operação
  - `[v0-team-ai-crafter/app/(app)/governance/page.tsx](../../v0-team-ai-crafter/app/(app)/governance/page.tsx)`: cartão de limpeza (admin)
  - Testes: `scheduling-api`, `register-scheduling-pack`, `agent-governance` (purge)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 58 (fechado)

- etapa/prioridade: ETAPA 9 / média-alta
- objetivo do slice: operação de reset da instalação apenas para admin de plataforma, com guardrails fortes
- **Semântica de reset total:** `deleteMany({})` em todas as coleções Mongoose de negócio da aplicação (paridade com o wipe inicial de `scripts/seed-demo.ts` + módulos posteriores — ver `wipe-factory-collections.ts`).
- **RBAC:** `authenticate` + `requirePlatformAdmin` (sem tenant).
- **Env:** `DANGER_ZONE_FACTORY_RESET_ENABLED=1` obrigatório; em `NODE_ENV=production` exige também `DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION=1`.
- **Confirmações:** corpo com `confirmPhrase: RESET_FACTORY_INSTALLATION`, `confirmEmail` igual ao token, `acknowledgeIrreversible: true`; em produção (quando permitido) `productionSafetyPhrase: DELETE_ALL_PRODUCTION_DATA`.
- **Auditoria:** log estruturado `platform.factory_reset` antes do wipe (a base deixa de conter utilizadores após a operação).
- **entregue no repositório:**
  - `GET /platform/danger-zone/status`, `POST /platform/danger-zone/factory-reset` — [`backend/src/modules/platform/interfaces/platform.routes.ts`](../../backend/src/modules/platform/interfaces/platform.routes.ts), wipe em [`backend/src/modules/platform/application/wipe-factory-collections.ts`](../../backend/src/modules/platform/application/wipe-factory-collections.ts)
  - [`v0-team-ai-crafter/app/(app)/settings/page.tsx`](../../v0-team-ai-crafter/app/(app)/settings/page.tsx): cartão “Zona de perigo” no separador Segurança (só platform admin)
  - Testes: [`backend/src/__tests__/platform-factory-reset.integration.test.ts`](../../backend/src/__tests__/platform-factory-reset.integration.test.ts)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 59 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: documentar o fluxo coordenador → especialista → `internal_action` → MongoDB; expor metadados PT-BR por `actionId` (presets + registry); endpoint read-only de catálogo para a UI; criar `WorkspaceToolDefinition` do tipo `internal_action` via select (sem `actionId` manual); rótulos amigáveis na ficha do agente; alinhar `ensureInternalActionDefinitions` aos presets quando existirem.
- **entregue no repositório:**
  - [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts): títulos/descrições/`packId` por `actionId`
  - [`business-tool-registry.ts`](../../backend/src/modules/business-tools/application/business-tool-registry.ts): `listCatalog()` (handlers registados + presets)
  - [`business-actions.routes.ts`](../../backend/src/modules/business-tools/interfaces/business-actions.routes.ts): `GET /api/v1/business-actions/catalog` (`preHandler: tenant`)
  - [`routes.ts`](../../backend/src/app/routes.ts): `registerBusinessActionRoutes`
  - [`ensure-planner-tool-definitions.ts`](../../backend/src/modules/team-planning/application/ensure-planner-tool-definitions.ts): `WorkspaceToolDefinition.name` a partir de presets quando existirem
  - [`business-tool-registry.test.ts`](../../backend/src/modules/business-tools/application/business-tool-registry.test.ts): catálogo
  - [`business-action-slug.ts`](../../v0-team-ai-crafter/lib/business-action-slug.ts): `actionIdToToolSlug` alinhado ao planner
  - [`tool-definitions/page.tsx`](../../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx): tipo «Ação interna (negócio)», combobox do catálogo, desduplicação, linhas com título amigável
  - [`agents/[id]/page.tsx`](../../v0-team-ai-crafter/app/%28app%29/agents/%5Bid%5D/page.tsx): rótulos a partir do catálogo + badge de pack quando aplicável
  - [`UI-RUNTIME-AGENT.md`](../UI-RUNTIME-AGENT.md): subsecção domínio de negócio / `internal_action`
  - [`agents-team-crafter-plano-evolucao.md`](agents-team-crafter-plano-evolucao.md): [§2.6](agents-team-crafter-plano-evolucao.md#26-ferramentas-openai-agents-sdk-utilizáveis-vs-apenas-habilitadas) e [Loop 59](agents-team-crafter-plano-evolucao.md#loop-59--catálogo-de-ações-de-negócio--ux-guiada-internal_action) no plano mestre
- critério de saída: catálogo só lista `actionId` com handler; gate com frontend porque o slice alterou `v0-team-ai-crafter`
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`
- **Seguinte evolução de UX (entregue no Loop 61):** criação **em lote** de várias `internal_action` — ver [Loop 61 (fechado)](#loop-61-fechado).

## Loop 60 (fechado)

- etapa/prioridade: ETAPA 9 (paridade produto/runtime e integrações) / alta
- objetivo do slice: eliminar a ferramenta de catálogo **`crm_access`** (integração HTTP `toolCrm` em Configurações) para que o utilizador e o modelo não confundam **CRM externo via GET catalog** com o **CRM interno** persistido no MongoDB (pack `crm`, ações `crm_*`, `PartyRepository`).
- **entregue no repositório:**
  - [`available-tools.ts`](../../backend/src/modules/agents/domain/available-tools.ts): removido `crm_access` do catálogo; `DEPRECATED_CATALOG_TOOL_IDS` + `stripDeprecatedCatalogToolIds`; runtime ignora ID legado (`isAllowedTool`).
  - [`agent-config.schemas.ts`](../../backend/src/modules/agents/application/agent-config.schemas.ts): `toolsSchema` filtra `crm_access` em PUT.
  - [`build-specialist-sdk-tools.ts`](../../backend/src/modules/runtime/application/build-specialist-sdk-tools.ts), [`tool-builtin-executors.ts`](../../backend/src/modules/runtime/application/tool-builtin-executors.ts): removidos executor e stub HTTP CRM.
  - [`operational-catalog-tools.ts`](../../backend/src/modules/agents/domain/operational-catalog-tools.ts): sem linha operacional `crm_access`.
  - [`workspace-integrations.schema.ts`](../../backend/src/modules/settings/domain/workspace-integrations.schema.ts), [`workspace-integrations.service.ts`](../../backend/src/modules/settings/application/workspace-integrations.service.ts): removido `toolCrm`; migração ao ler payload cifrado (remove `toolCrm` e regrava ou anula segredos).
  - [`tool-integration.types.ts`](../../backend/src/shared/kernel/tool-integration.types.ts): removido `crm` do contexto.
  - [`settings/page.tsx`](../../v0-team-ai-crafter/app/(app)/settings/page.tsx): removido cartão CRM; copy “Leitura rápida” alinhada ao CRM de negócio.
  - [`UI-RUNTIME-AGENT.md`](../UI-RUNTIME-AGENT.md): matriz e integrações atualizadas.
- critério de saída: sem `catalog_crm_access` nem `toolCrm` de primeira classe; gate verde backend + frontend.
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (203 testes backend no encerramento deste slice).

## Loop 61 (fechado)

- etapa/prioridade: ETAPA 9 (UX Tools do workspace) / alta
- objetivo do slice: **melhorar a UX** na página [`tool-definitions/page.tsx`](../../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx) para **selecionar e adicionar várias** tools `internal_action` **numa única operação**, em vez de repetir o diálogo **Nova tool** para cada `actionId`.
- **Decisão:** `POST /api/v1/tool-definitions/bulk-internal-actions` com corpo `{ actionIds: string[] }` (até 64), resposta `{ created, skipped, errors }`; idempotente por workspace (`already_defined`, `not_in_catalog`, `slug_collision`).
- **entregue no repositório:**
  - [`tool-definition.routes.ts`](../../backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts): `POST /api/v1/tool-definitions/bulk-internal-actions` (`requireAdmin`)
  - [`tool-definitions-bulk.integration.test.ts`](../../backend/src/__tests__/tool-definitions-bulk.integration.test.ts): criação múltipla + segunda chamada só `skipped`
  - [`tool-definitions/page.tsx`](../../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx): lista com checkboxes + «Seleccionar todas» / «Limpar»; botão «Adicionar (N)»; toasts agregados
- critério de saída: utilizador cria N `internal_action` sem N passagens pelo fluxo; catálogo continua a ser `GET /business-actions/catalog`.
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**204** testes backend no encerramento deste slice).

### Relação com o Loop 59 (fechado)

O Loop 59 entregou catálogo read-only e `useMemo` no cliente API. O Loop 61 substitui o combobox **single-select** por **lista com selecção múltipla** para `internal_action` na mesma página.

## Loop 62 (fechado)

- etapa/prioridade: ETAPA 9 (UX AI Builder / team plan) / alta
- objetivo do slice: quando `plannerMeta.usedFallback` é verdadeiro, a UI deve mostrar **a razão** (`fallbackReason`) e o **detalhe técnico** opcional (`parseErrorSummary`) já devolvidos pelo backend, em PT-BR, no toast e no alerta «Plano em modo template» — sem obrigar o utilizador a inspecionar a rede.
- **entregue no repositório:**
  - [`planner-fallback-messages.ts`](../../v0-team-ai-crafter/lib/planner-fallback-messages.ts): mapa de mensagens por `fallbackReason` + `parseErrorSummary`
  - [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx): toast com título/descrição; alerta com explicação, código e bloco «Detalhe tecnico (suporte)»
- critério de saída: causas `no_openai_key`, `openai_request_failed`, `json_extract_failed`, `schema_validation_failed` identificáveis na revisão do plano.
- Gate: `npm run build` em `v0-team-ai-crafter` (sem alteração de backend obrigatória para este slice).
- **referência no plano mestre:** [Loop 62](agents-team-crafter-plano-evolucao.md#loop-62--transparência-do-fallback-do-team-planner-ai-builder)

## Loop 63 (fechado)

- etapa/prioridade: ETAPA 9 (contrato team planner / canais) / alta
- objetivo do slice: alinhar `team.primaryChannel`, `agents[].channels`, rotas de agentes/times e `channelConfig.enabled` ao **mesmo conjunto de tipos** que o modelo `Channel` e o Chat SDK (`telegram`, `discord`, `teams`, … + `email`, `api`), evitando `schema_validation_failed` no planner quando o modelo devolve `primaryChannel: "telegram"`.
- **entregue no repositório:**
  - [`product-channel-type.ts`](../../backend/src/modules/channels/domain/product-channel-type.ts): `PRODUCT_CHANNEL_TYPES`, `productChannelTypeSchema`
  - [`team-plan-planner-output.schema.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.ts): `plannerOutputSchema` com `productChannelTypeSchema`; import em [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts)
  - [`channel.routes.ts`](../../backend/src/modules/channels/interfaces/channel.routes.ts), [`agent.routes.ts`](../../backend/src/modules/agents/interfaces/agent.routes.ts), [`team.routes.ts`](../../backend/src/modules/teams/interfaces/team.routes.ts), [`agent-config.schemas.ts`](../../backend/src/modules/agents/application/agent-config.schemas.ts): enum partilhado
  - [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts): lista dinâmica de canais + regras Telegram / multi-especialista / exemplos de `requiredPacks`
  - [`v0-team-ai-crafter/lib/types/index.ts`](../../v0-team-ai-crafter/lib/types/index.ts): `TeamPlanAgentDraft.channels` e `TeamPlanDraft.team.primaryChannel` como `ChannelType`
  - [`team-plan-planner-output.schema.test.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.test.ts): aceita `telegram` e regressão `api`
- critério de saída: JSON do planner com `telegram` valida sem fallback por enum de canal; gate com frontend.
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**206** testes backend no encerramento deste slice).
- **referência no plano mestre:** [Loop 63](agents-team-crafter-plano-evolucao.md#loop-63--paridade-planner--canais-chat-sdk--nativos)

## Loop 64 (fechado)

- etapa/prioridade: ETAPA 9 (norma §2.6 — builtins por domínio na criação de times) / alta
- objetivo do slice: cada agente do plano (coordenador e especialistas) passa a ter **builtins do catálogo** (`capabilities.tools`) **materializadas** — subconjunto mínimo por papel, diferenciado entre especialistas quando o planner não define lista explícita; AI Builder permite **edição manual** antes de salvar/executar.
- **entregue no repositório:**
  - [`available-tools.ts`](../../backend/src/modules/agents/domain/available-tools.ts): `normalizeCatalogToolIds`
  - [`planner-agent-catalog-tools.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts): inferência por keywords (+ [Loop 84](#loop-84-fechado): hints por packs, sem rotação por índice); `resolveCatalogToolsForPlanAgent`
  - [`team-plan-planner-output.schema.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.ts): `agents[].catalogTools` normalizado
  - [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts): materialização em `createPlan` / `updatePlan`; `executePlan` grava `capabilities.tools` em agentes **novos**
  - [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts): instruções + JSON com `catalogTools`
  - [`team-plan.model.ts`](../../backend/src/modules/team-planning/infra/team-plan.model.ts): persistência de `catalogTools` no agente do plano
  - [`catalog-tool-ids.ts`](../../v0-team-ai-crafter/lib/catalog-tool-ids.ts) + [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx): checkboxes por agente
  - Testes: [`planner-agent-catalog-tools.test.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.test.ts), extensão de [`team-plan-planner-output.schema.test.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.test.ts)
- **Comportamento default vs manual:** default = lista do planner se válida; senão inferência no servidor ao criar/atualizar plano; utilizador pode alterar checkboxes no AI Builder (PUT `/team-plans/:id`); na execução, agentes novos recebem `capabilities.tools` conforme o plano (business tools continuam via `requiredTools` / `requiredPacks` + bind como antes).
- **Critério de produto (executáveis vs stub):** builtins continuam sujeitos à matriz [`UI-RUNTIME-AGENT.md`](../UI-RUNTIME-AGENT.md) / [`operational-catalog-tools.ts`](../../backend/src/modules/agents/domain/operational-catalog-tools.ts); este loop **não** promove integrações novas — apenas **seleção e persistência** por agente.
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend no encerramento deste slice).
- **referência no plano mestre:** [Loop 64](agents-team-crafter-plano-evolucao.md#loop-64--builtins-por-domínio-criação-de-time-e-ai-builder)
- **Extensão documentada no plano mestre:** prompts mais rígidos + enforcement de unicidade de builtins de negócio — [Loop 77 (fechado)](#loop-77-fechado) / [Loop 78 (fechado)](#loop-78-fechado).

## Loop 65 (fechado)

- etapa/prioridade: ETAPA 9 (shell autenticado / UX multi-device) / alta
- objetivo do slice: **foundation responsiva** — app shell utilizável em mobile/tablet sem sidebar fixa a roubar largura; navegação principal acessível via drawer; header com pesquisa e identidade do workspace adaptáveis; sem overflow horizontal transversal no corpo.
- **Padrões adotados (documentação viva no código):**
  - Breakpoints alinhados ao Tailwind: `md` ≈ 768px (tablet), `lg` ≈ 1024px (sidebar fixa); referências de viewport em [`responsive-breakpoints.ts`](../../v0-team-ai-crafter/lib/responsive-breakpoints.ts).
  - **`< lg`:** `AppSidebar` oculto; `MobileNavSheet` (Radix Sheet à esquerda) com a mesma lista de rotas que o desktop; botão menu no `AppHeader`.
  - **`≥ lg`:** sidebar visível com recolher opcional (inalterado em intenção).
  - **Header:** pesquisa a partir de `md`; workspace e utilizador compactos em `sm`; alvos de toque ≥ 44px (`h-11` / `min-h-11`) nos ícones principais.
  - **Layout:** `100dvh`, `min-w-0` na coluna de conteúdo, `main` com `overflow-x-hidden`; `body` com `overflow-x-hidden` em [`globals.css`](../../v0-team-ai-crafter/app/globals.css); toasts `top-center` para telas estreitas.
- **Fora do âmbito deste slice (Loop 66+):** conversão sistemática de cada `Dialog`/`modal` largo em drawer por rota; tabelas densas → cards — previsto no candidato Loop 66.
- **entregue no repositório:**
  - [`app-shell-context.tsx`](../../v0-team-ai-crafter/components/layout/app-shell-context.tsx), [`mobile-nav-sheet.tsx`](../../v0-team-ai-crafter/components/layout/mobile-nav-sheet.tsx)
  - [`app-navigation.tsx`](../../v0-team-ai-crafter/components/layout/app-navigation.tsx) (lista de navegação partilhada), refactor [`app-sidebar.tsx`](../../v0-team-ai-crafter/components/layout/app-sidebar.tsx), [`app-header.tsx`](../../v0-team-ai-crafter/components/layout/app-header.tsx), [`app/(app)/layout.tsx`](../../v0-team-ai-crafter/app/(app)/layout.tsx)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (backend inalterado neste slice; **210** testes backend no último run completo).
- **referência no plano mestre:** [Loop 65](agents-team-crafter-plano-evolucao.md#loop-65--foundation-responsiva-multi-device)

## Loop 66 (fechado)

- etapa/prioridade: ETAPA 9 (UX crítica / tablet e mobile) / alta
- objetivo do slice: aplicar a foundation do Loop 65 às rotas com maior atrito — tabelas com scroll horizontal, cabeçalhos e tabs utilizáveis em viewport estreita, diálogos sem estourar a altura útil, CTAs empilháveis.
- **Ledger por rota / superfície**

| Rota ou componente | Estado |
| --- | --- |
| `/schedule` | **entregue** — tabela de compromissos em [`ResponsiveTableScroll`](../../v0-team-ai-crafter/components/ui/responsive-table.tsx); diálogos com `max-h` + `overflow-y-auto`; grelhas data/hora em 1 coluna em `xs` |
| `/tool-definitions` | **entregue** — contentor `min-w-0` + padding responsivo; cabeçalho em coluna em `xs`; linhas da lista empilhadas; diálogo “Nova tool” com scroll |
| `/teams/create` + `TeamCreationHub` | **entregue** — `TabsList` em grelha 2×1 em mobile; título responsivo |
| `TeamAiBuilder` (incl. `/teams/ai-create`) | **entregue** — cabeçalho e CTAs empilhados em `xs`; pré-visualização React Flow `h-[220px]` → `sm:h-[280px]`; ações “Salvar” / “Executar” largura total em `xs` |
| `/teams/[id]` | **entregue** — cabeçalho em coluna; ações com `flex-wrap`; tabs com scroll horizontal `< lg` e grelha 5 colunas `≥ lg` |
| `/agents/[id]` | **entregue** — cabeçalho em coluna; botão Salvar largura total em `xs`; tabs com scroll `< lg` e 7 colunas `≥ lg` |
| `/channels` | **aceitável com limitação** — título `text-2xl sm:text-3xl`; grelha de cards já adaptável; sem refactor profundo de cartões |
| `/settings` | **aceitável com limitação** — título responsivo; grelha de tabs existente (2/3/6) mantida |
| Modais “largos” → drawer sistemático | **pendente** (fora do escopo deste slice; previsto como evolução futura) |

- **entregue no repositório:** [`responsive-table.tsx`](../../v0-team-ai-crafter/components/ui/responsive-table.tsx); alterações em [`schedule/page.tsx`](../../v0-team-ai-crafter/app/(app)/schedule/page.tsx), [`tool-definitions/page.tsx`](../../v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx), [`team-creation-hub.tsx`](../../v0-team-ai-crafter/components/teams/team-creation-hub.tsx), [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx), [`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx), [`agents/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx), [`channels/page.tsx`](../../v0-team-ai-crafter/app/(app)/channels/page.tsx), [`settings/page.tsx`](../../v0-team-ai-crafter/app/(app)/settings/page.tsx)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend; `next build` OK).
- **referência no plano mestre:** [Loop 66](agents-team-crafter-plano-evolucao.md#loop-66--responsividade-das-telas-críticas)

## Loop 67 (fechado)

- etapa/prioridade: ETAPA 9 (onboarding contextual) / alta
- objetivo do slice: tours **curtos por ecrã**, sem tour global obrigatório; persistência de versão vista por `userId` + `workspaceId` + `screenKey`; reapresentação quando a **versão de conteúdo** do ecrã sobe no catálogo.
- **Contrato de persistência:** `user.preferences.contextualTours.byWorkspace[workspaceId][screenKey] = número` (última versão de conteúdo vista ou marcada como “não mostrar”). Merge profundo só no ramo `contextualTours` via `PUT /settings/profile` (já suporta merge de chaves de primeiro nível em `preferences`).
- **Regras de reentrada:**
  - **Auto:** ao montar o ecrã, se `seenVersion < catalog[screenKey].version` e não houver snooze de sessão (`sessionStorage`), abre após ~500 ms.
  - **Mais tarde:** grava snooze de sessão; não persiste versão.
  - **Não mostrar de novo / Concluir:** persiste `seenVersion = catalog.version`.
  - **Fechar (ESC/overlay):** snooze de sessão (evita repetir imediatamente no mesmo reload).
  - **Ver tour desta tela:** abre sempre (manual).
  - **Reapresentar a todos após alteração de copy:** incrementar `version` em [`contextual-tours-catalog.ts`](../../v0-team-ai-crafter/lib/contextual-tours-catalog.ts) para esse `screenKey`.

| Ecrã (`screenKey`) | Rota / componente |
| --- | --- |
| `dashboard` | `/dashboard` |
| `ai_builder` | `TeamCreationHub` (`/teams/create`, `/teams/ai-create`) |
| `tool_definitions` | `/tool-definitions` |
| `settings` | `/settings` |
| `channels` | `/channels` |
| `schedule` | `/schedule` |

- **Fora deste slice:** tours ancorados a seletores DOM (spotlight), RBAC por passo, e cobertura de todas as rotas.
- **entregue no repositório:** [`contextual-tours.ts`](../../v0-team-ai-crafter/lib/contextual-tours.ts), [`contextual-tours-catalog.ts`](../../v0-team-ai-crafter/lib/contextual-tours-catalog.ts), [`contextual-tour.tsx`](../../v0-team-ai-crafter/components/onboarding/contextual-tour.tsx); integrações nas páginas listadas; tipo `IContextualToursPreferences` em [`lib/types`](../../v0-team-ai-crafter/lib/types/index.ts).
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend; `next build` OK).
- **referência no plano mestre:** [Loop 67](agents-team-crafter-plano-evolucao.md#loop-67--onboarding-contextual-e-tour-reexecutável-por-tela)

## Loop 68 (fechado)

- etapa/prioridade: ETAPA 9 (onboarding contextual — fase 2) / média-alta
- objetivo do slice: **mesma infraestrutura do Loop 67** (`ContextualTourHost` / `ManualTrigger`, persistência `contextualTours.byWorkspace`), com **novos `screenKey`** e copy em [`contextual-tours-catalog.ts`](../../v0-team-ai-crafter/lib/contextual-tours-catalog.ts) para rotas de lista de alto tráfego ainda sem tour.
- **Ecrãs adicionados (v1 de conteúdo):**

| `screenKey` | Rota |
| --- | --- |
| `agents_catalog` | `/agents` |
| `teams_list` | `/teams` |
| `runs_list` | `/runs` |
| `templates_catalog` | `/templates` |

- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (backend + `next build`).
- **referência no plano mestre:** [Loop 68](agents-team-crafter-plano-evolucao.md#loop-68--expansão-dos-tours-contextuais-listagens)

## Loop 69 (fechado)

- etapa/prioridade: ETAPA 9 (onboarding contextual — fase 3) / média-alta
- objetivo do slice: mesma infraestrutura dos Loops 67–68; novos `screenKey` para **`/governance`** e **`/observability`**.

| `screenKey` | Rota |
| --- | --- |
| `governance_workspace` | `/governance` |
| `observability_metrics` | `/observability` |

- **Continuação (Loop 70):** tours nas fichas `/agents/[id]` e `/teams/[id]` — entregue.
- **entregue no repositório:** extensão de [`contextual-tours.ts`](../../v0-team-ai-crafter/lib/contextual-tours.ts), [`contextual-tours-catalog.ts`](../../v0-team-ai-crafter/lib/contextual-tours-catalog.ts); [`governance/page.tsx`](../../v0-team-ai-crafter/app/(app)/governance/page.tsx), [`observability/page.tsx`](../../v0-team-ai-crafter/app/(app)/observability/page.tsx).
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`.
- **referência no plano mestre:** [Loop 69](agents-team-crafter-plano-evolucao.md#loop-69--tours-contextuais-governança-e-observabilidade)

## Loop 70 (fechado)

- etapa/prioridade: ETAPA 9 (onboarding contextual — fase 4) / média-alta
- objetivo do slice: tours nas **fichas de detalhe** `/agents/[id]` e `/teams/[id]`; persistência por `screenKey` lógico (`agent_detail`, `team_detail`), não por id de entidade.

| `screenKey` | Rota |
| --- | --- |
| `agent_detail` | `/agents/[id]` |
| `team_detail` | `/teams/[id]` |

- **Fora do escopo:** spotlight DOM (slice futuro).
- **entregue no repositório:** [`contextual-tours.ts`](../../v0-team-ai-crafter/lib/contextual-tours.ts), [`contextual-tours-catalog.ts`](../../v0-team-ai-crafter/lib/contextual-tours-catalog.ts); [`agents/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx), [`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx).
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`.
- **referência no plano mestre:** [Loop 70](agents-team-crafter-plano-evolucao.md#loop-70--tours-contextuais-fichas-agente-e-time)

## Loop 71 (fechado)

- etapa/prioridade: ETAPA 9 (UX responsiva — continuação) / média
- objetivo do slice: alargar o padrão **`ResponsiveTableScroll`** ([`responsive-table.tsx`](../../v0-team-ai-crafter/components/ui/responsive-table.tsx)) às tabelas que ainda causavam **overflow horizontal** ou não tinham **scroll tátil** consistente em viewports estreitas.
- **Ficheiros tocados:**
  - [`runs/page.tsx`](../../v0-team-ai-crafter/app/(app)/runs/page.tsx) — lista de execuções
  - [`governance/page.tsx`](../../v0-team-ai-crafter/app/(app)/governance/page.tsx) — SLO por time (substitui `div.overflow-x-auto`), linha do tempo, auditoria paginada
  - [`workspace-team-section.tsx`](../../v0-team-ai-crafter/components/workspace/workspace-team-section.tsx) — convites (Settings / equipa)
- **Fora do escopo:** conversão de tabelas em **cards** por breakpoint; spotlight em tours.
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`.
- **referência no plano mestre:** [Loop 71](agents-team-crafter-plano-evolucao.md#loop-71-tabelas-scroll)

## Loop 72 (fechado)

- **etapa/prioridade:** ETAPA 9 (onboarding contextual — fase avançada) / média-alta
- **objetivo:** passos de tour **opcionalmente ancorados** a elementos da UI (spotlight) com **fallback** para o modo `Dialog` quando o alvo não existe; contrato `contextualTours.byWorkspace` + `tourVersion` mantido.
- **Entregas:**
  - Modelo [`ContextualTourAnchor`](../../v0-team-ai-crafter/lib/contextual-tours.ts) + `resolveContextualTourAnchor`; passos com `anchor` opcional no catálogo.
  - [`tour-spotlight-overlay.tsx`](../../v0-team-ai-crafter/components/onboarding/tour-spotlight-overlay.tsx) — máscara em quatro faixas, `useTourAnchorRect`, `TourSpotlightLayer` (portal).
  - [`contextual-tour.tsx`](../../v0-team-ai-crafter/components/onboarding/contextual-tour.tsx) — alterna dialog / spotlight; `Escape` em spotlight = snooze; polling curto se o DOM do ancoragem aparece tarde.
  - Piloto: **`dashboard`** e **`runs_list`** — `version` 2; primeiro passo com `dataAttr` → `data-tour-anchor` em [`dashboard/page.tsx`](../../v0-team-ai-crafter/app/(app)/dashboard/page.tsx) e [`runs/page.tsx`](../../v0-team-ai-crafter/app/(app)/runs/page.tsx); segundo passo sem anchor permanece em dialog.
  - ADR: [`ADR-2026-04-contextual-tour-spotlight.md`](../adr/ADR-2026-04-contextual-tour-spotlight.md)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend no encerramento deste slice).
- **referência no plano mestre:** [Loop 72](agents-team-crafter-plano-evolucao.md#loop-72-spotlight-tours)

## Loop 73 (fechado)

- **etapa/prioridade:** ETAPA 9 (UX responsiva — listagens) / média
- **objetivo:** em **viewports estreitas**, lista em **cartões** para uma listagem densa, com paridade de dados e ações face à tabela em `md+`.
- **Política de breakpoint:** **`md` e acima** (`≥768px`) — tabela dentro de `ResponsiveTableScroll`; **abaixo de `md`** — lista vertical de cartões (`RunsListMobileCards`).
- **Rota piloto:** `/runs` — ficheiros: [`runs/page.tsx`](../../v0-team-ai-crafter/app/(app)/runs/page.tsx), [`runs-list-mobile-cards.tsx`](../../v0-team-ai-crafter/components/runs/runs-list-mobile-cards.tsx).

| Coluna (tabela) | Campo no cartão | CTA primário |
| --- | --- | --- |
| Estado | `Badge` no topo | — |
| Início | `time` (canto, `dateTime`) | — |
| Run | `h3` monoespaçado (ID completo) | — |
| Time | `dl` / Time | — |
| Origem | `dl` / Origem (+ canal) | — |
| (ligações) | — | **Abrir time** → `/teams/[teamId]` (texto + ícone; paridade com ícone na tabela) |

- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend + `next build` no encerramento deste slice).
- **referência no plano mestre:** [Loop 73](agents-team-crafter-plano-evolucao.md#loop-73-listagens-cards)

<a id="loop-74-fechado"></a>

## Loop 74 (fechado)

- **etapa/prioridade:** ETAPA 9 (UX responsiva — listagens) / média
- **objetivo:** vista em **cartões** nas tabelas densas da rota **`/governance`** em viewports **&lt; md**, com paridade de dados e mesmas ações que em `md+`.
- **Política de breakpoint:** alinhada ao [Loop 73 (fechado)](#loop-73-fechado) — **`md` e acima** tabela dentro de `ResponsiveTableScroll`; **abaixo de `md`** lista vertical de cartões.
- **Ficheiros:** [`governance/page.tsx`](../../v0-team-ai-crafter/app/(app)/governance/page.tsx), [`governance-dense-lists-mobile-cards.tsx`](../../v0-team-ai-crafter/components/governance/governance-dense-lists-mobile-cards.tsx).

### SLO por time

| Coluna (tabela) | Campo no cartão | CTA primário |
| --- | --- | --- |
| Time | `h3` (nome do time) | — |
| OK / Falha | `dl` com valores tabulares | — |
| Taxa | `dl` / Taxa | — |
| p50 / p95 | `dl` (latência formatada) | — |
| SLO | `Badge` (Dentro / Fora / —) no canto | — |

### Linha do tempo (resumo)

| Coluna (tabela) | Campo no cartão | CTA primário |
| --- | --- | --- |
| Evento | `Badge` (tipo formatado) + JSON do payload se existir | — |
| Quando | `time` (`dateTime`, canto) | — |

### Auditoria completa (página atual)

| Coluna (tabela) | Campo no cartão | CTA primário |
| --- | --- | --- |
| Evento | `Badge` (`eventType` monoespaçado) | — |
| Payload | bloco `font-mono` com `JSON.stringify` | — |
| Quando | `time` (`dateTime`, canto) | — |

Paginação, exportação CSV/JSON, limpeza de auditoria e políticas do workspace **inalterados**; permissões 403 na auditoria mantêm o mesmo fluxo.

- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend + `next build` no encerramento deste slice).
- **referência no plano mestre:** [Loop 74](agents-team-crafter-plano-evolucao.md#loop-74-cards-governance)

<a id="loop-74-candidato"></a>

<a id="loop-75-fechado"></a>

## Loop 75 (fechado)

- **etapa/prioridade:** ETAPA 9 (UX responsiva — listagens) / média
- **objetivo:** em **`/tool-definitions`**, **tabela densa** em **`md+`** e **cartões** em **`<md`**, com as **mesmas** ações (ativar/desativar, remover) e os mesmos dados resumidos.
- **Política de breakpoint:** [Loop 73 (fechado)](#loop-73-fechado) — `≥md` → `ResponsiveTableScroll` + `Table`; **`<md`** → `ToolDefinitionsListMobileCards`.
- **Ficheiros:** [`tool-definitions/page.tsx`](../../v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx), [`tool-definitions-list-mobile-cards.tsx`](../../v0-team-ai-crafter/components/tool-definitions/tool-definitions-list-mobile-cards.tsx), [`tool-definitions-display.ts`](../../v0-team-ai-crafter/lib/tool-definitions-display.ts) (helpers partilhados).

### Lista de tools

| Coluna (tabela) | Campo no cartão | CTA / ações |
| --- | --- | --- |
| Estado | `Badge` Ativa / Desativada (topo com nome e tipo) | — |
| Nome | título (`font-medium`) | — |
| Slug | `font-mono` | — |
| Tipo | `Badge` outline (`kind`) | — |
| Resumo | linha `describeToolConfig` | — |
| Ações | `Switch` + ícone remover | **Switch** — ativar/desativar; **Trash** — eliminar definição |

**Nota:** nos cartões, o texto longo de **dependências** (`describeToolDependencies`) permanece visível para leitura em ecrã estreito; na tabela desktop o detalhe fica implícito no resumo e na documentação da página.

- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend + `next build` no encerramento deste slice).
- **referência no plano mestre:** [Loop 75](agents-team-crafter-plano-evolucao.md#loop-75-cards-tool-definitions)

<a id="loop-75-candidato"></a>

<a id="loop-76-fechado"></a>

## Loop 76 (fechado)

- **etapa/prioridade:** ETAPA 9 (UX responsiva — listagens) / média
- **objetivo:** em **`/templates`**, **tabela** do catálogo em **`md+`** e **`TemplateCard`** empilhados em **`<md`**, mantendo os **Tabs** de filtro por origem e as mesmas ações que nos cartões.
- **Política de breakpoint:** [Loop 73 (fechado)](#loop-73-fechado) — `≥md` → `ResponsiveTableScroll` + `Table`; **`<md`** → grelha só com [`TemplateCard`](../../v0-team-ai-crafter/components/templates/template-card.tsx) (uma coluna).
- **Ficheiros:** [`templates/page.tsx`](../../v0-team-ai-crafter/app/(app)/templates/page.tsx).

### Catálogo (linha da tabela ↔ cartão)

| Coluna (tabela) | Campo no cartão (`TemplateCard`) | CTA / ações |
| --- | --- | --- |
| Template | título + vertical opcional | — |
| Origem | `Badge` origem (cores no cartão) | — |
| v / Categoria | linha versão + categoria | — |
| Agentes | “N no modelo” | — |
| Descrição | parágrafo `line-clamp` | — |
| Ações | “Usar Template” + Share (empresa) | **Usar** → dialog aplicar; **Share** → toast (empresa) |

Filtros por tab (**Todos / Whitebeard / Meus Templates**) aplicam-se à lista **e** à tabela (`filteredTemplates`).

- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**210** testes backend + `next build` no encerramento deste slice).
- **referência no plano mestre:** [Loop 76](agents-team-crafter-plano-evolucao.md#loop-76-cards-templates)

<a id="loop-76-candidato"></a>

<a id="loop-77-fechado"></a>

## Loop 77 (fechado)

- **etapa/prioridade:** ETAPA 9 (team planner / AI Builder) / alta
- **objetivo:** endurecer **system prompt** e **mensagem de utilizador** (`buildTeamPlannerUserMessage`) para domínio por especialista, `catalogTools` intencionais, **anti-duplicação** de IDs de catálogo entre especialistas (lista `PLANNER_SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS`), e distinção **`requiredPacks` / `requiredTools` / `catalogTools`**.
- **Ficheiros:** [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts), [`team-plan-planner-prompt.test.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.test.ts) (regressão de texto).
- **IDs exclusivos entre especialistas (prompt):** `database_query`, `calendar_access`, `internal_actions`, `email_send`, `image_generation`, `file_search` — ver constante exportada no ficheiro; enforcement no servidor em [Loop 78 (fechado)](#loop-78-fechado).

### Micro-etapas Ralph (A–D) — cobertura neste slice

| ID | Cobertura |
| --- | --- |
| **A** Partição de domínios | Prompt exige `category` distinto por especialista e texto anti-sobreposição de assunto. |
| **B** Inventário de builtins | Instruções para `catalogTools` mínimos por papel; exemplo JSON com `catalogTools` por agente. |
| **C** Unicidade entre especialistas | Secção "Unicidade de catalogTools entre ESPECIALISTAS" + contra-exemplo `database_query` duplicado. |
| **D** JSON válido + normalização | Alinhado a `plannerOutputSchema` / `normalizeCatalogToolIds`; sem alteração de schema neste slice. |

- Gate: `./scripts/ralph-loop-gate.sh` (**214** testes backend no encerramento deste slice; frontend não tocado).
- **referência no plano mestre:** [Loop 77](agents-team-crafter-plano-evolucao.md#loop-77-planner-prompts-builtin-domain)

<a id="loop-77-candidato"></a>

<a id="loop-78-fechado"></a>

## Loop 78 (fechado)

- **etapa/prioridade:** ETAPA 9 (team plan / AI Builder) / alta
- **objetivo:** **validação servidor** em `create` / `update` / início de `execute` do team plan e **UX** no AI Builder quando **dois especialistas** partilham o mesmo ID de **`catalogTools` de domínio** (lista canónica alinhada ao [Loop 77](#loop-77-fechado)); coordenador ignorado na regra.
- **Política:** **rejeitar** com `400` / `VALIDATION_ERROR` (sem normalização silenciosa); mensagem em PT com IDs e nomes dos agentes.
- **Backend:** [`planner-specialist-catalog-uniqueness.ts`](../../backend/src/modules/team-planning/domain/planner-specialist-catalog-uniqueness.ts) (`assertSpecialistsExclusiveCatalogTools`), chamado desde [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts) após materialização de `catalogTools`; constante reexportada em [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts) para uma única fonte de verdade com o prompt.
- **Frontend:** [`catalog-tool-ids.ts`](../../v0-team-ai-crafter/lib/catalog-tool-ids.ts) (`SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS`); [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx) — alertas e bloqueio de **Salvar** / **Executar** quando há colisão.
- **Testes:** [`planner-specialist-catalog-uniqueness.test.ts`](../../backend/src/modules/team-planning/domain/planner-specialist-catalog-uniqueness.test.ts) (unidade); [`team-plans.integration.test.ts`](../../backend/src/__tests__/team-plans.integration.test.ts) — `POST` com reparo automático ([Loop 80](#loop-80-fechado)); `PUT` manual com colisão → 400.
- **Gate:** `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**218** testes backend + `next build`).
- **referência no plano mestre:** [Loop 78](agents-team-crafter-plano-evolucao.md#loop-78-enforcement-builtin-ambiguity)

<a id="loop-79-fechado"></a>

## Loop 79 (fechado)

- **etapa/prioridade:** ETAPA 9 (AI Builder / team plan) / média
- **objetivo:** completar o fluxo do [Loop 51 (fechado)](#loop-51-fechado) quando o utilizador edita **overrides por agente**: reativar definitions inativas **na linha do `actionId`** (sem depender só dos cartões de Tool definitions ou do botão em lote).
- **Frontend:** [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx) — para `actionId` em `actionIdsBlockedByDisabledDefinitions`: checkbox desativado até o preview refletir definition ativa; botão **Ativar definition** chama `POST /team-plans/:id/bind-enable-definitions` (mesmo endpoint do Loop 51).
- **Gate:** `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (testes backend inalterados neste slice; `next build` obrigatório).
- **referência no plano mestre:** [Loop 79](agents-team-crafter-plano-evolucao.md#loop-79-ai-builder-bind-inactive-per-action)

<a id="loop-80-fechado"></a>

## Loop 80 (fechado)

- **etapa/prioridade:** ETAPA 9 (team planner / AI Builder) / alta
- **objetivo:** no **`POST /api/v1/team-plans`** (geração com OpenAI), quando `catalogTools` **materializados** (incl. inferência em [`planner-agent-catalog-tools.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts)) colidirem entre especialistas, **rechamar o modelo** com `TEAM_PLANNER_REPAIR_SYSTEM_PROMPT` e plano + diagnóstico, até unicidade ou limite de tentativas; fallback `buildFallback` com `fallbackReason` `catalog_uniqueness_exhausted_repair` ou `catalog_repair_parse_failed`.
- **Âmbito:** [Loop 78](#loop-78-fechado) inalterado para **`PUT`** / edição manual (`assertSpecialistsExclusiveCatalogTools` continua a devolver 400).
- **Backend:** [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts) — `resolveCatalogUniquenessWithRepair`, `evaluateMaterializedCatalogUniqueness`, `fetchRepairedPlannerOutput`; [`planner-specialist-catalog-uniqueness.ts`](../../backend/src/modules/team-planning/domain/planner-specialist-catalog-uniqueness.ts) — `getSpecialistsCatalogToolConflicts`, `formatCatalogToolConflictsForMessage`; [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts) — `TEAM_PLANNER_REPAIR_SYSTEM_PROMPT`, `buildTeamPlannerRepairUserMessage`, reforço da micro-etapa **F** na mensagem do utilizador principal.
- **`plannerMeta`:** `catalogToolRepairAttempts`, `catalogUniquenessRepaired` (opcionais); env `TEAM_PLAN_CATALOG_REPAIR_MAX_ATTEMPTS` (default 3, máx. 8).
- **Testes:** [`team-plans.integration.test.ts`](../../backend/src/__tests__/team-plans.integration.test.ts) — reparo em 2 chamadas fetch; `PUT` com colisão → 400; unidade em `planner-specialist-catalog-uniqueness.test.ts` e `team-plan-planner-prompt.test.ts`.
- **Gate:** `./scripts/ralph-loop-gate.sh` (**222** testes backend no encerramento deste slice; frontend não tocado).
- **referência no plano mestre:** [Loop 80](agents-team-crafter-plano-evolucao.md#loop-80-planner-auto-repair-ia)

<a id="loop-81-fechado"></a>

## Loop 81 (fechado)

- **etapa/prioridade:** ETAPA 9 (AI Builder / criação assistida de times) / altíssima
- **problema:** o preview repetia a grelha dos **8** `CATALOG_TOOL_IDS` por agente — funcional, mas **denso**.
- **entrega:** [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx) — por agente: **Missão / objective** em evidência; **chips** com `catalogTools` activas; botão **Editar ferramentas** abre **Dialog** com grupos “Domínio” (`SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS`) vs “Utilitários” (`CATALOG_UTILITY_TOOL_IDS` em [`catalog-tool-ids.ts`](../../v0-team-ai-crafter/lib/catalog-tool-ids.ts)); ao activar exclusivo já usado por outro especialista → `toast.error` (alinha a [Loop 78](#loop-78-fechado)); **Collapsible** para descrição, skills e overlap; **Collapsible** para pré-visualização do grafo (fechado por defeito). Bind/packs/capabilities sugeridas mantêm o cartão existente quando aplicável (progressive disclosure parcial).
- **Micro-etapas H–K:** cobertas no sentido **H, I, K**; **J** parcial (grafo + detalhes agente recolhíveis; bind denso não movido para accordion neste slice).
- **Testes / gate:** `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **222** testes backend; `next build` OK.
- **referência no plano mestre:** [Loop 81](agents-team-crafter-plano-evolucao.md#loop-81-ai-builder-ux-preview-simples)

---

<a id="loop-82-fechado"></a>

## Loop 82 (fechado) — Contrato do planner por agente e workflow ownership

- **etapa/prioridade:** ETAPA 9 (team planner / contrato JSON) / altíssima
- **objetivo do slice:** o plano declara por agente **`workflowKey`**, **`requiredBusinessActionIds`** e **`requiredPackIds`**; especialistas não partilham o mesmo `workflowKey` no plano (desambiguação automática com sufixos `__1`, `__2`…); `requiredPacks` / `requiredTools` globais inalterados para visão macro.
- **Backend:** [`team-plan-planner-output.schema.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-output.schema.ts) + [`planner-workflow-ownership.ts`](../../backend/src/modules/team-planning/domain/planner-workflow-ownership.ts); [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts); [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts) (`buildFallback`, `formatPlanPayloadForRepair`, `agentGraphData`); [`team-plan.model.ts`](../../backend/src/modules/team-planning/infra/team-plan.model.ts).
- **Frontend:** [`v0-team-ai-crafter/lib/types/index.ts`](../../v0-team-ai-crafter/lib/types/index.ts); cartão **Plano por agente** em [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx).
- **Bind operacional por agente** quando há listas por agente — [Loop 83](#loop-83-fechado) (*entregue*).
- **Testes / gate:** unidade acima + `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **227** testes backend; `next build` OK.
- **referência no plano mestre:** [Loop 82](agents-team-crafter-plano-evolucao.md#loop-82-contrato-do-planner-por-agente-e-ownership-por-workflow) — **entregue**; ver [checklist](#checklist-do-loop-82-fechado).

<a id="loop-83-fechado"></a>

## Loop 83 (fechado) — Bind preview e execute per-agent

- **etapa/prioridade:** ETAPA 9 (team plan bind) / altíssima
- **objetivo do slice:** candidatos de `actionId` por agente quando o plano tem `requiredBusinessActionIds` / `requiredPackIds`; caso contrário, modo **global** legado (todos os agentes com o mesmo conjunto derivado de `requiredTools` / `requiredPacks`).
- **Backend:** [`planner-pack-presets.ts`](../../backend/src/modules/team-planning/application/planner-pack-presets.ts) — `computePlannerBindActionUniverse`, `mergePlannerPackIdsForBind`; [`team-plan.service.ts`](../../backend/src/modules/team-planning/application/team-plan.service.ts) — `buildBindPreview`, overrides em `updatePlan` / `updateBindOverrides`; preview inclui `bindResolutionMode`.
- **Frontend:** [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx); [`lib/types`](../../v0-team-ai-crafter/lib/types/index.ts).
- **Testes / gate:** [`planner-pack-presets.test.ts`](../../backend/src/modules/team-planning/application/planner-pack-presets.test.ts); `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **232** testes.
- **referência no plano mestre:** [Loop 83](agents-team-crafter-plano-evolucao.md#loop-83-bind-preview-e-execute-per-agent-fim-do-bind-global)

<a id="loop-84-fechado"></a>

## Loop 84 (fechado) — Built-ins mínimas por papel + hints por packs

- **etapa/prioridade:** ETAPA 9 (inferência) / alta
- **objetivo do slice:** reduzir inferência agressiva quando `catalogTools` vem vazio — sem rotação por índice; fallback mínimo (`web_search`); packs por agente (`requiredPackIds`) ou globais reforçam hints controlados (`calendar_access`, `internal_actions`).
- **Backend:** [`planner-agent-catalog-tools.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts) — `inferCatalogPackContextLower`, `inferCatalogToolsForPlanAgent`; [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts) — parágrafo Loop 84.
- **Testes / gate:** [`planner-agent-catalog-tools.test.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.test.ts), [`team-plan-planner-prompt.test.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.test.ts); `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **237** testes.
- **referência no plano mestre:** [Loop 84](agents-team-crafter-plano-evolucao.md#loop-84-built-ins-mínimas-por-papel--enforcement-por-workflow)

<a id="loop-85-fechado"></a>

## Loop 85 (fechado) — UX do AI Builder: preview estável e execute fluido

- **etapa/prioridade:** ETAPA 9 (AI Builder) / alta
- **objetivo do slice:** não invalidar preview/aprovação de bind por edições que **não** afectam o cálculo de bind no servidor; alinhar “há revisão de bind?” a hints globais **e** por agente.
- **Frontend:** [`team-plan-bind-fingerprint.ts`](../../v0-team-ai-crafter/lib/team-plan-bind-fingerprint.ts); [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx) — `proposePlanUpdate`, `planHasBindReviewHints`.
- **critério de saída:** gate com frontend.
- **referência no plano mestre:** [Loop 85](agents-team-crafter-plano-evolucao.md#loop-85-ux-do-ai-builder-preview-estável-e-execute-fluido)

---

<a id="loop-86-oficial"></a>
<a id="loop-86-fechado"></a>

## Loop 86 (fechado) — AI Builder: destravar execute, bind review proporcional e workflow ownership explícito

**Estado:** **fechado** — especificação de engenharia no [anexo](ralph-loop-86-ai-builder-unblock.md); diagnóstico inicial tratado no código abaixo.

### Entregas

- **Backend — workflow:** [`planner-workflow-uniqueness.ts`](../../backend/src/modules/team-planning/domain/planner-workflow-uniqueness.ts) (`getSpecialistWorkflowConflicts`, `assertSpecialistWorkflowOwnership`); [`planner-workflow-ownership.ts`](../../backend/src/modules/team-planning/domain/planner-workflow-ownership.ts) já **não** sufixa `workflowKey` duplicado; `evaluateMaterializedPlannerStructure` + mesmo ciclo de reparo OpenAI que [Loop 80](#loop-80-fechado) para conflitos de **catálogo e/ou workflow**; `assertSpecialistWorkflowOwnership` em `createPlan`, `updatePlan`, `executePlan`.
- **Backend — bind:** [`buildBindPreview`](../../backend/src/modules/team-planning/application/team-plan.service.ts) — `requiresExplicitApproval` só com `selectedActionIds`, operações `create`/`reactivate` em definitions, ou overrides aplicados (não basta `actionIdsFull`).
- **Backend — inferência:** [`inferCatalogPackContextLower`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts) — se qualquer especialista tiver hints per-agent, os que não têm `requiredPackIds` **não** herdam `requiredPacks` globais.
- **Prompts:** [`team-plan-planner-prompt.ts`](../../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts) — reparo menciona `workflowKey`; sistema já pedia workflow único por especialista.
- **Frontend:** [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx) — `requiresExplicitBindApproval` a partir de `bindPreview.requiresExplicitApproval`; [`team-plan-bind-preview-fingerprint.ts`](../../v0-team-ai-crafter/lib/team-plan-bind-preview-fingerprint.ts) preserva aprovação quando o preview é semanticamente equivalente; cartão de preview sempre visível; **blockers** resumidos acima do CTA; checkbox de aprovação só quando `requiresExplicitApproval`.
- **Testes:** [`planner-workflow-uniqueness.test.ts`](../../backend/src/modules/team-planning/domain/planner-workflow-uniqueness.test.ts); [`team-plans.integration.test.ts`](../../backend/src/__tests__/team-plans.integration.test.ts) (reparo workflow + `PUT` 400); [`planner-agent-catalog-tools.test.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.test.ts).
- **Gate:** `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` — **245** testes backend; `next build` OK.

### Micro-etapas Ralph (A–K)

- **C / G:** unicidade de workflow entre especialistas validada e incluída no reparo do `POST`; `PUT` manual continua a devolver `400` em conflito.
- **H–K:** execute e copy do preview alinhados ao contrato `requiresExplicitApproval`; aprovação não cai em refresh compatível (fingerprint).

---

<a id="loop-87-oficial"></a>
<a id="loop-87-fechado"></a>

## Loop 87 (fechado) — Especialistas operacionais: schemas reais, coleta de dados faltantes e contexto conversacional

**Estado:** **fechado** — especificação: [`ralph-loop-87-especialistas-operacionais.md`](ralph-loop-87-especialistas-operacionais.md); plano mestre [§ Loop 87](agents-team-crafter-plano-evolucao.md#loop-87-especialistas-operacionais-schemas-reais-coleta-de-dados-faltantes-e-contexto-conversacional).

### Objetivo do slice

Fechar a lacuna entre arquitectura pronta e **especialistas utilizáveis** em conversa: tools com schema válido (modo estrito), `internal_action` com contrato, CRM credível, slot-filling, chat de teste com memória.

### Entregas (resumo)

- **A — Schemas** — `query` obrigatória em `catalog_*` e args genéricos de webhook (`build-specialist-sdk-tools.ts` exporta `catalogQueryArgs`); parâmetro `arguments` obrigatório em tools MCP HTTP; [`build-workspace-custom-tools.ts`](../../backend/src/modules/runtime/application/build-workspace-custom-tools.ts) alinhado.
- **B — Planner** — deixou de inferir `internal_actions` para packs de negócio ([`planner-agent-catalog-tools.ts`](../../backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts)); o ID continua no catálogo para compatibilidade, mas o caminho preferido para negócio é `customToolDefinitionIds` → `internal_action`.
- **C — Contrato** — `TBusinessActionPreset` com `inputSchema`, exemplos e hints; `GET /business-actions/catalog` devolve os novos campos; [`ensureInternalActionDefinitions`](../../backend/src/modules/team-planning/application/ensure-planner-tool-definitions.ts) grava schema canónico e actualiza definitions antigas genéricas quando existe preset.
- **D — CRM** — `Party.status` (`active`/`inactive`), [`crm_list_parties`](../../backend/src/modules/crm/application/register-crm-pack.ts), `crm_create_party` com `customer` por omissão em `roles`.
- **D.1 — CRM update schema (hotfix pós-loop)** — `crm_update_party` passou a publicar `inputSchema` explícito em [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts) com `partyId` obrigatório e campos opcionais (`displayName`, `roles`, `status`, `email`, `phone`, `notes`), evitando fallback genérico de schema em tools `ws_*` sob validação estrita.
- **E — Slot-filling** — validação pré-handler + `errorCode: MISSING_REQUIRED_FIELDS` em [`business-tool-runtime.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime.ts); reforço de instruções no coordenador ([`coordinator-orchestrator.service.ts`](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts)).
- **F — Debug** — `conversationId` no body do run; modelo [`TeamDebugSession`](../../backend/src/modules/team-runtime/infra/team-debug-session.model.ts) + repositório; histórico em [`format-coordinator-user-message.ts`](../../backend/src/modules/team-runtime/application/format-coordinator-user-message.ts); UI [`team-debug-console.tsx`](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx) com **Nova conversa** e label curta do ID.

### Checklist (fechado)

- [x] **A — Schemas** — conforme acima.
- [x] **B — Desambiguação** — conforme acima (catálogo `internal_actions` mantido; inferência removida no planner).
- [x] **C — Contrato por action** — conforme acima.
- [x] **D — CRM** — conforme acima.
- [x] **D.1 — Hotfix schema `crm_update_party`** — preset com contrato explícito + teste de regressão em [`business-tool-registry.test.ts`](../../backend/src/modules/business-tools/application/business-tool-registry.test.ts).
- [x] **E — Slot-filling** — conforme acima.
- [x] **F — Debug conversacional** — conforme acima.
- [x] **Testes** — unitários: `build-specialist-sdk-tools`, `business-tool-runtime`, `business-tool-registry`, `planner-agent-catalog-tools`, `register-crm-pack`.
- [x] **Gate** — `npm run build` + `npm test` no backend; `npm run build` no frontend (`v0-team-ai-crafter/`). *Nota:* a suíte completa de integração pode falhar por quotas/limites do ambiente; validar subset unitário + builds.

### Gaps CRM / clientes

O registo [Gaps — domínios de negócio](#gap-runtime-dominios-negocio) permanece como orientação para **verticais adicionais** (finanças, care, …) em **Loops 96+**; a macro-onda **89–95** cobre **operação / UX** após o [Loop 88](#loop-88-fechado) (ver [backlog recomendado](#backlog-recomendado-após-o-loop-87)).

---

<a id="loop-88-fechado"></a>

## Loop 88 (fechado) — Preflight operacional / readiness do time

**Estado:** **fechado** — plano mestre [§ Loop 88](agents-team-crafter-plano-evolucao.md#loop-88--preflight-operacional-do-team--readiness-do-runtime).

### Objetivo do slice

Superfície única de **prontidão** antes de operar o time: estado, agentes, grafo, canais, integrações para tools de catálogo e definitions custom.

### Entregas (resumo)

- **Contrato** — `ITeamReadinessResult` / `ITeamReadinessItem` em [`team-readiness.types.ts`](../../backend/src/modules/teams/application/team-readiness.types.ts); níveis `ready` | `attention` | `blocked`; itens com `nextStep` e `routeHint`.
- **Backend** — [`computeTeamReadiness`](../../backend/src/modules/teams/application/team-readiness.service.ts) (time, coordenador, agentes, integrações vs `database_query` / `calendar_access` / `image_generation`, definitions, canais, validação de grafo); `GET /api/v1/teams/:id/readiness` em [`team.routes.ts`](../../backend/src/modules/teams/interfaces/team.routes.ts).
- **Frontend** — tipos em [`v0-team-ai-crafter/lib/types/index.ts`](../../v0-team-ai-crafter/lib/types/index.ts); cartão na aba **Visão geral** em [`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx).
- **Testes** — [`team-readiness.service.test.ts`](../../backend/src/modules/teams/application/team-readiness.service.test.ts).

### Checklist (fechado)

- [x] Contrato + serviço + rota HTTP.
- [x] UI mínima (badges, lista, links `routeHint`).
- [x] Testes unitários do serviço.
- [x] Gate — build backend + frontend; subset de testes conforme ambiente.

---

<a id="loop-89-fechado"></a>

## Loop 89 (fechado) — AI Builder simples por defeito, avançado sob demanda

**Estado:** **fechado** — plano mestre [§ Loop 89](agents-team-crafter-plano-evolucao.md#loop-89--ai-builder-com-modo-simples-por-defeito-e-avançado-sob-demanda).

### Entregas (resumo)

- **Modo simples (defeito):** alerta curto de capabilities; secção **Confirmação rápida de bind** (badges, atualizar, ativar definitions inativas, checkbox de aprovação quando `requiresExplicitApproval`, link para modo avançado); bloco técnico «Loop 82» por agente oculto; edição de ferramentas de catálogo remetida ao modo avançado.
- **Modo avançado:** UI anterior do preview de bind completo (sem alteração de lógica de bind no servidor).
- **Ordem visual:** equipa / agentes / grafo (ordem 3) antes do cartão de bind (ordem 4), via `flex` + `order-*`.
- **Persistência:** `localStorage` chave `team-ai-builder-advanced` para lembrar o modo avançado.
- **Ficheiro:** [`team-ai-builder.tsx`](../../v0-team-ai-crafter/components/teams/team-ai-builder.tsx).

### Checklist (fechado)

- [x] Switch modo simples / avançado + cópia de UI.
- [x] Resumo de bind executável sem listar definitions por defeito.
- [x] Gate frontend: `npm run build` + eslint no ficheiro tocado.

---

<a id="loop-90-fechado"></a>

## Loop 90 (fechado) — Cockpit operacional do time

**Estado:** **fechado** — plano mestre [§ Loop 90](agents-team-crafter-plano-evolucao.md#loop-90--cockpit-operacional-do-team).

### Entregas (resumo)

- **Cartão «Cockpit operacional»** na aba **Visão geral** ([`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx)): última run (estado, fonte, canal, link para tab Execução); canais do time (ligados / total, aviso se algum ≠ `connected`).
- **«O que resolver agora»:** até 4 itens do readiness (severidade primeiro); alerta se coordenador em falta.
- **Atalhos:** Console, Execução, Canais, editor de grafo, lista global de runs — com **tabs controladas** (`value` / `onValueChange`) para mudar de painel a partir dos botões.

### Checklist (fechado)

- [x] Visão executiva sem duplicar conteúdo das abas.
- [x] Gate: `npm run build` no frontend.

---

<a id="loop-91-candidato--console-conversacional-com-sessões-e-timeline"></a>
<a id="loop-91-fechado"></a>

## Loop 91 (fechado) — Console conversacional com sessões e timeline

**Estado:** **fechado** — plano mestre [§ Loop 91](agents-team-crafter-plano-evolucao.md#loop-91--console-conversacional-com-sessões-timeline-e-contexto-reutilizável).

### Entregas (resumo)

- **API:** `GET /teams/:id/debug-sessions` e `GET /teams/:id/debug-sessions/:conversationId` — lista de sessões persistidas (`TeamDebugSession`) e turnos com instantes ([`team.routes.ts`](../../backend/src/modules/teams/interfaces/team.routes.ts), [`team-debug-session.repository.ts`](../../backend/src/modules/team-runtime/infra/team-debug-session.repository.ts)).
- **UI:** [`team-debug-console.tsx`](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx) — selector de sessão, refresh, histórico carregado do servidor com marca de tempo por turno; bloco **«Fluxo da última execução (narrativa)»** a partir de `events` + resumos de especialistas ([`team-debug-narrative.ts`](../../v0-team-ai-crafter/components/teams/team-debug-narrative.ts)); JSON técnico mantém-se em colapsável.
- **Contexto de nomes:** `coordinatorAgentId`, `agentDisplayNames` na ficha do time e no grafo para labels na narrativa.

### Checklist (fechado)

- [x] Sessão reutilizável + lista; narrativa legível sem JSON obrigatório.
- [x] Gate: `npm run build` backend + `npm run build` frontend (`v0-team-ai-crafter`). *Nota:* `npm test` no backend reportou 2 falhas pré-existentes em `channel-delete` / `team-active-channel-binding` (403 vs 201); não relacionadas com este slice.

<a id="loop-92-candidato--resolver-pendências-com-cta-directo"></a>
<a id="loop-92-fechado"></a>

## Loop 92 (fechado) — Resolver pendências com CTA directo

**Estado:** **fechado** — plano mestre [§ Loop 92](agents-team-crafter-plano-evolucao.md#loop-92--resolver-pendências-com-cta-directo).

### Entregas (resumo)

- **Contrato:** `ctaLabel` opcional em [`ITeamReadinessItem`](../../backend/src/modules/teams/application/team-readiness.types.ts) / resposta `GET /teams/:id/readiness`; `routeHint` mais específicos (`/settings?tab=integrations`, `/teams/:id?tab=channels|agents|overview`, etc.) em [`team-readiness.service.ts`](../../backend/src/modules/teams/application/team-readiness.service.ts).
- **UI:** [`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx) — botões **secondary** por item (card Prontidão + «O que resolver agora» no cockpit); sincronização `?tab=` com as abas do time (`overview` | `agents` | `channels` | `runs` | `debug`); CTA explícito quando o coordenador está em falta.

### Checklist (fechado)

- [x] CTA directo por pendência com copy curta; menos cliques que o link «Abrir» inline.
- [x] Gate: `npm run build` backend + `npm test --testPathPattern=team-readiness` + `npm run build` frontend.

<a id="loop-93-fechado"></a>

## Loop 93 (fechado) — Runs legíveis, replay e troubleshooting

**Estado:** **fechado** — plano mestre [§ Loop 93](agents-team-crafter-plano-evolucao.md#loop-93--runs-legíveis-replay-e-troubleshooting-rápido).

### Entregas (resumo)

- **Backend:** `GET /runs` e `GET /teams/:id/runs` com filtros opcionais `status` e `source`; `listRuns` no repositório alinhado ([`run.repository.ts`](../../backend/src/modules/runs/infra/run.repository.ts), [`run.routes.ts`](../../backend/src/modules/runs/interfaces/run.routes.ts)).
- **Frontend:** helpers [`runs-display.ts`](../../v0-team-ai-crafter/lib/runs-display.ts); aba **Execução** com [`TeamRunsTab`](../../v0-team-ai-crafter/components/teams/team-runs-tab.tsx) em [`teams/[id]/page.tsx`](../../v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx) — filtros, cards expansíveis, `GET /runs/:id` com passos, timeline com nomes de agentes (coordenador + especialistas), **Retestar no console** → aba debug; cockpit usa amostra `GET /teams/:id/runs?limit=15`.

### Checklist (fechado)

- [x] Runs legíveis na ficha do time; filtros; detalhe com passos; atalho para o console.
- [x] Gate: `npm run build` backend + `npm run build` frontend (`v0-team-ai-crafter`).
- [x] `runs.integration.test.ts` depende do pacote `chat` resolvível no Jest — em ambientes sem esse stub o suite pode falhar ao carregar a app; não é regressão deste slice.

<a id="loop-94-fechado"></a>

## Loop 94 (fechado) — Templates operacionais e cenários dourados

**Estado:** **fechado** — plano mestre [§ Loop 94](agents-team-crafter-plano-evolucao.md#loop-94--templates-operacionais-e-cenários-dourados-de-validação).

### Entregas (resumo)

- **Backend:** [`template.model.ts`](../../backend/src/modules/templates/infra/template.model.ts) — `validationSteps`, `goldenPrompts`, `expectedOutcome`; [`template.repository.ts`](../../backend/src/modules/templates/infra/template.repository.ts) expõe-os em listagem e `GET /templates/:id`.
- **Seed:** [`seed-demo.ts`](../../backend/scripts/seed-demo.ts) — três templates demo com guia de validação e prompts de teste.
- **Frontend:** [`Template`](../../v0-team-ai-crafter/lib/types/index.ts) alinhado; [`templates/page.tsx`](../../v0-team-ai-crafter/app/(app)/templates/page.tsx) — secções *Como validar*, *Comportamento esperado*, *Prompts de teste* com copiar; após `POST /templates/:id/apply`, navegação para **`/teams/:id?tab=debug`**; [`template-card.tsx`](../../v0-team-ai-crafter/components/templates/template-card.tsx) indica quando há guia.

### Checklist (fechado)

- [x] Critérios do plano (validação + prompts + comportamento esperado) reflectidos em dados e UI.
- [x] Gate: `npm run build` backend + `npm run build` frontend.

<a id="loop-981-fechado--norma-oficial-de-contrato-de-tools"></a>

## Loop 98.1 (fechado) — Norma oficial de contrato de tools

- **Etapa / prioridade:** ETAPA 9 / alta (transversal de runtime e produto).
- **Objetivo do slice:** registar formalmente que **prompt-only não garante contrato**; a garantia vem de schema canónico + normalização controlada + validação estrita + retry seguro + observabilidade.
- **Referências cruzadas:** [Loop 87](#loop-87-fechado) (fundação) e [Loop 97](ralph-loop-97-garantia-schema-crm-displayname.md) (caso CRM `displayName`).
- **Documento base:** [`ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md`](ralph-loop-98-endurecimento-contrato-tools-runtime-prompts-autocorrecao.md).
- **Critério de saída:** posição oficial inequívoca no `docs/RALPHLOOP` + roadmap 98.1→98.9 explícito e auditável no plano/ledger.

### Entregas (resumo)

- Norma oficial consolidada no anexo do Loop 98 e referenciada no ledger como frente transversal.

### Checklist (fechado)

- [x] Regra explícita: contrato garantido pelo sistema (não só por prompts).
- [x] Referências cruzadas com Loops 87 e 97.

<a id="loop-982-fechado--pipeline-canónico-do-boundary-da-tool"></a>

## Loop 98.2 (fechado) — Pipeline canónico do boundary da tool

- **Objetivo do slice:** formalizar no runtime a sequência canónica `rawInput` → normalização por `actionId` → validação estrita → execução.

### Entregas (resumo)

- [`business-tool-runtime.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime.ts) passou a preservar explicitamente `rawInput`, `normalizedInput` e `submittedInput` em todos os ramos (`UNKNOWN_ACTION`, `MISSING_REQUIRED_FIELDS`, sucesso, `EXECUTION_ERROR`), com `validationResult` coerente por estágio.

### Checklist (fechado)

- [x] Boundary canónico aplicado no runtime por `actionId`.
- [x] Cobertura unitária de contrato no runtime.

<a id="loop-983-fechado--observabilidade-obrigatória-do-contrato"></a>

## Loop 98.3 (fechado) — Observabilidade obrigatória do contrato

- **Objetivo do slice:** padronizar trilha mínima de diagnóstico para falhas de contrato de tools.

### Entregas (resumo)

- [`business-tool-audit.repository.ts`](../../backend/src/modules/business-tools/infra/business-tool-audit.repository.ts) e [`business-tool-audit.model.ts`](../../backend/src/modules/business-tools/infra/business-tool-audit.model.ts) agora persistem previews por etapa (`rawInputPreview`, `normalizedInputPreview`, `submittedInputPreview`), `missingFields` e `validationResultPreview`.
- [`business-tool-runtime.test.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime.test.ts) reforça asserções para payload auditado nos cenários de sucesso, validação, normalização e ação desconhecida.

### Checklist (fechado)

- [x] Trilha observável por etapa no audit.
- [x] Testes unitários alinhados ao contrato.

<a id="loop-984-fechado--retry-seguro-e-limitado"></a>

## Loop 98.4 (fechado) — Retry seguro e limitado

- **Objetivo do slice:** bloquear retry cego de `EXECUTION_ERROR` e permitir retry apenas quando houver diagnóstico de erro transitório e ação idempotente/retry-safe.

### Entregas (resumo)

- [`business-tool-runtime.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime.ts) agora executa com no máximo **1 retry adicional** (`MAX_SAFE_EXECUTION_RETRIES = 1`) somente quando:
  - o `actionId` é classificado como **retry-safe** (ações de leitura/listagem/sumário e `business.ping`);
  - a mensagem de erro combina com padrão de **transiente** (`timeout`, `429`, `503`, `econnreset`, etc.).
- Tentativas com retry passam a ser auditadas com `errorCode: EXECUTION_RETRY`; falha final segue como `EXECUTION_ERROR` com metadados de decisão de retry no payload auditado.
- [`business-tool-runtime.test.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime.test.ts) cobre:
  - retry único para ação retry-safe com erro transitório;
  - ausência de retry para ação não retry-safe, mesmo com erro transitório.

### Checklist (fechado)

- [x] Retry limitado e orientado por diagnóstico.
- [x] Sem retry automático para `UNKNOWN_ACTION` e `MISSING_REQUIRED_FIELDS` (continua bloqueado no boundary antes da execução).
- [x] Cobertura unitária do ramo de retry.

<a id="loop-985-fechado--contrato-explícito-de-prompts-alinhado-ao-runtime"></a>

## Loop 98.5 (fechado) — Contrato explícito de prompts alinhado ao runtime

- **Objetivo do slice:** ajustar os prompts de especialistas para colaborar com o boundary endurecido, deixando explícito que prompt sozinho não garante contrato.

### Entregas (resumo)

- [`build-specialist-system-instruction.ts`](../../backend/src/modules/runtime/application/build-specialist-system-instruction.ts) passou a anexar a secção **Tool contract policy (Loop 98.5)** com regras explícitas para:
  - confirmar obrigatórios antes de chamar tool de negócio;
  - tratar `MISSING_REQUIRED_FIELDS` usando `missingFields` + `submittedInput` (sem repetir payload inválido);
  - proibir retry cego em `EXECUTION_ERROR`;
  - não repetir `UNKNOWN_ACTION` e orientar alternativa.
- [`build-specialist-system-instruction.test.ts`](../../backend/src/modules/runtime/application/build-specialist-system-instruction.test.ts) ganhou asserções para garantir a presença dessas regras no texto final.

### Checklist (fechado)

- [x] Prompt reforça que runtime é a fonte de verdade do contrato.
- [x] Sem linguagem de “garantia mágica” por prompt-only.
- [x] Teste unitário cobre a política de contrato no prompt.

<a id="loop-986-fechado--biblioteca-de-normalização-por-actionid"></a>

## Loop 98.6 (fechado) — Biblioteca de normalização por `actionId`

- **Objetivo do slice:** substituir normalização pontual por uma biblioteca explícita de regras por action, com aliases permitidos e testes por ação.

### Entregas (resumo)

- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts) evoluiu para uma biblioteca de regras `ACTION_FIELD_NORMALIZATION_RULES` indexada por `actionId`.
- Regras de alias `displayName` passaram a cobrir `crm_create_party` **e** `crm_update_party`.
- Normalização permanece **controlada por action**: sem fallback heurístico genérico para actions sem regra.
- Novo teste dedicado [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) cobre alias por ação, casos sem regra e inputs não-objeto.

### Checklist (fechado)

- [x] Biblioteca de regras por `actionId` implementada.
- [x] Aliases e transformações simples testados por ação.
- [x] Sem normalização automática fora da matriz explícita de regras.

<a id="loop-987-fechado--matriz-de-segurança-por-actionid"></a>

## Loop 98.7 (fechado) — Matriz de segurança por `actionId`

- **Objetivo do slice:** classificar ações por segurança de normalização (Classe A/B/C), limitando auto-normalização apenas aos casos seguros.

### Entregas (resumo)

- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts) agora define `TActionNormalizationSafetyClass` e `ACTION_NORMALIZATION_CONFIGS` com `safetyClass` por ação.
- Política aplicada no runtime de normalização:
  - **Classe A**: auto-normalização permitida.
  - **Classe B/C**: sem auto-normalização por omissão (exige política explícita futura).
- Exposição de `getActionNormalizationSafetyClass(actionId)` para inspeção e testes.
- [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) cobre comportamento por classe (`A`, `B`, `C`) e valida que classe `B` não auto-normaliza por padrão.

### Checklist (fechado)

- [x] Matriz de segurança por ação implementada.
- [x] Classe A/B/C aplicada na decisão de auto-normalização.
- [x] Cobertura unitária da classificação e comportamento por classe.

<a id="loop-988-fechado--debug-conversacional-e-ux-de-incidente"></a>

## Loop 98.8 (fechado) — Debug conversacional e UX de incidente

- **Objetivo do slice:** tornar falhas de tools legíveis no console/debug com narrativa orientada a incidente (código + detalhe + próximo passo sugerido).

### Entregas (resumo)

- [`openai-agents-runtime.provider.ts`](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts) passa a mapear `function_call_output` para atualizar eventos `toolResult` com `status: error`, `errorCode` e `detail` quando o output JSON da tool indica falha (`ok: false`).
- [`build-workspace-custom-tools.ts`](../../backend/src/modules/runtime/application/build-workspace-custom-tools.ts) passou a devolver envelope canónico de output para `internal_action` (`ok`, `error`, `errorCode`, `result`) para diagnóstico consistente.
- [`team-debug-narrative.ts`](../../v0-team-ai-crafter/components/teams/team-debug-narrative.ts) ganhou narrativa de incidente com hints por `errorCode` (`MISSING_REQUIRED_FIELDS`, `EXECUTION_ERROR`, `UNKNOWN_ACTION`) e detalhe truncado amigável.
- Novo teste [`openai-agents-runtime.provider.test.ts`](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.test.ts) valida mapeamento de erro de tool para evento `toolResult` com `errorCode`.

### Checklist (fechado)

- [x] Erros de tool chegam ao debug com código e detalhe.
- [x] Narrativa de incidente orienta próxima ação sem expor JSON cru ao utilizador final.
- [x] Cobertura unitária do mapeamento de output de tool para evento.

<a id="loop-989-fechado--regressão-mínima-por-pack"></a>

## Loop 98.9 (fechado) — Regressão mínima por pack

- **Objetivo do slice:** garantir um teste mínimo de boundary/runtime para verticais prioritárias de negócio, evitando regressão silenciosa ao evoluir contrato de tools.

### Entregas (resumo)

- Novo teste [`business-tool-runtime-pack-regression.test.ts`](../../backend/src/modules/business-tools/application/business-tool-runtime-pack-regression.test.ts) com cenário feliz por pack prioritário:
  - CRM (`crm_create_party`)
  - Care (`care_create_subject`)
  - Finance (`finance_create_payable`)
  - Reminders (`schedule_create_reminder`)
  - Scheduling (`schedule_create_appointment`)
- O teste valida presença de `packId` no preset e execução `ok` via `BusinessToolRuntime` para cada vertical coberta.

### Checklist (fechado)

- [x] Regressão mínima multi-pack adicionada no backend.
- [x] Cobertura explícita para CRM, Care, Finance, Reminders e Scheduling.
- [x] Gate com build + testes verdes.

**Próximo slice recomendado após 98.9:** **Loop 99 — vertical Scheduling/Reminders (contrato explícito + aliases seguros)**.

<a id="loop-99-fechado--vertical-scheduling-contrato-explicito-e-normalizacao-segura"></a>

## Loop 99 (fechado) — Vertical Scheduling: contrato explícito + normalização segura

- **Objetivo do slice:** executar o próximo recorte 96+ por `packId` com foco em `scheduling`/`reminders`, reduzindo falhas por payload incompleto e aliases naturais não reconhecidos.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts) recebeu `inputSchema` explícito para ações de lembretes e agenda:
  - reminders: `schedule_create_reminder`, `schedule_list_reminders_by_date`, `schedule_mark_reminder_done`, `schedule_cancel_reminder`;
  - scheduling: `schedule_set_availability`, `schedule_create_appointment`, `schedule_reschedule_appointment`, `schedule_cancel_appointment`, `schedule_delete_appointment`, `schedule_confirm_appointment`, `schedule_mark_no_show`, `schedule_complete_appointment`, `schedule_list_agenda_by_date`, `schedule_get_availability`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts) adicionou normalização classe **A** para aliases seguros no domínio de agenda:
  - `startAt`/`inicio` → `startsAt`; `endAt`/`fim` → `endsAt`;
  - `customerId`/`clientId` → `partyId`;
  - `day`/`dia` → `date`;
  - `reminderAt` → `remindAt`.
- Nova cobertura de regressão:
  - [`business-action-presets.scheduling.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.scheduling.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) para aliases de scheduling.

### Checklist (fechado)

- [x] Ações de Scheduling/Reminders publicam contrato de entrada explícito em presets.
- [x] Normalização por `actionId` cobre aliases naturais de agenda sem heurística genérica.
- [x] Cobertura de testes dedicada para schema + normalização da vertical.

**Próximo slice recomendado após o Loop 99:** **Loop 100 — vertical Finance (contrato explícito das ações restantes + aliases seguros mínimos)**.

<a id="loop-100-fechado--vertical-finance-contrato-explicito-e-normalizacao-segura"></a>

## Loop 100 (fechado) — Vertical Finance: contrato explícito + normalização segura

- **Objetivo do slice:** fechar o próximo recorte por `packId` na vertical `finance`, removendo contratos implícitos nas ações de baixa e agregados.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - adiciona `inputSchema` explícito com `required` para:
    - `finance_mark_receivable_paid` (`receivableId`);
    - `finance_mark_payable_paid` (`payableId`);
  - adiciona schema explícito de objeto vazio (`required: []`) para ações read-only sem parâmetros:
    - `finance_list_overdue_receivables`,
    - `finance_list_overdue_payables`,
    - `finance_total_receivable_by_payer`,
    - `finance_total_payable_by_destination`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - normalização classe **A** para aliases seguros em:
    - `finance_mark_receivable_paid` (`id`/`tituloId` → `receivableId`);
    - `finance_mark_payable_paid` (`id`/`tituloId` → `payableId`);
    - `finance_customer_financial_summary` (`customerId`/`clientId` → `partyId`).
- Cobertura de regressão:
  - novo [`business-action-presets.finance.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.finance.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) para aliases de finance.

### Checklist (fechado)

- [x] Ações financeiras de baixa e agregados publicam contrato explícito no catálogo.
- [x] Aliases naturais em ações financeiras críticas foram normalizados por `actionId`.
- [x] Testes unitários cobrem contratos e normalização da vertical.

**Próximo loop em aberto recomendado após o Loop 100:** **Loop 101 — vertical Care (normalização segura de `subjectKind` + robustez semântica)**.

<a id="loop-101-fechado--vertical-care-normalizacao-semantica-de-subjectkind"></a>

## Loop 101 (fechado) — Vertical Care: normalização semântica de `subjectKind`

- **Objetivo do slice:** reduzir falhas por variação natural de idioma no `care` pack, normalizando de forma determinística valores de tipo de sujeito (`subjectKind`) no boundary.

### Entregas (resumo)

- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - `TActionFieldNormalizationRule` passou a suportar `valueAliases` por regra;
  - nova tabela `CARE_SUBJECT_KIND_VALUE_ALIASES` para mapear valores naturais:
    - `humano`/`pessoa` → `human`;
    - `pet` → `animal`;
    - `psicologico`/`psicológico`/`psiquico` → `psych`.
  - regras de `care_create_subject` e `care_update_subject` aplicam normalização de valor em `subjectKind`.
- [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts):
  - cenário de criação com `tipo: "humano"` normalizando para `subjectKind: "human"`;
  - cenário de atualização com `kind: "pet"` normalizando para `subjectKind: "animal"`.

### Checklist (fechado)

- [x] Normalização do `care` cobre sinónimos frequentes de `subjectKind`.
- [x] Mapeamento é explícito por `actionId` e sem heurística genérica.
- [x] Testes unitários cobrem os novos caminhos de normalização semântica.

**Próximo loop em aberto recomendado após o Loop 101:** **Loop 102 — vertical Clinical (contrato explícito das actions clínicas + aliases seguros mínimos)**.

<a id="loop-102-fechado--vertical-clinical-contrato-explicito-e-normalizacao-segura"></a>

## Loop 102 (fechado) — Vertical Clinical: contrato explícito + normalização segura

- **Objetivo do slice:** fechar a vertical `clinical` com contratos explícitos no catálogo e normalização canónica de aliases por `actionId`.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - `inputSchema` + `requiredFieldLabels` para:
    - `clinical_create_anamnesis`,
    - `clinical_add_evolution_note`,
    - `clinical_list_subject_history`,
    - `clinical_get_latest_evolution`,
    - `clinical_open_encounter`,
    - `clinical_close_encounter`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - aliases seguros para `careSubjectId` em actions clínicas;
  - aliases para `partyId` em `clinical_open_encounter`;
  - aliases para `encounterId` em `clinical_close_encounter`.
- Cobertura de regressão:
  - novo [`business-action-presets.clinical.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.clinical.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) com cenários clínicos.

### Checklist (fechado)

- [x] Todas as actions clínicas possuem contrato de input explícito no preset.
- [x] Normalização por `actionId` cobre aliases clínicos críticos (subject/party/encounter).
- [x] Cobertura unitária valida contrato + normalização da vertical.

**Próximo loop em aberto recomendado após o Loop 102:** **Loop 103 — vertical Packages/Encounters (contrato explícito das actions de pacote/atendimento + aliases seguros mínimos)**.

<a id="loop-103-fechado--vertical-packages-encounters-contrato-explicito-e-normalizacao-segura"></a>

## Loop 103 (fechado) — Vertical Packages/Encounters: contrato explícito + normalização segura

- **Objetivo do slice:** fechar a vertical `packages_encounters` com contratos explícitos nas actions de pacote/atendimento e aliases seguros de identificação no boundary.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - `inputSchema` + `requiredFieldLabels` para:
    - `package_sell_to_party`,
    - `package_get_balance`,
    - `attendance_register_session`,
    - `attendance_list_by_party`,
    - `attendance_list_by_package_sale`,
    - `attendance_get_party_care_summary`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - aliases seguros para IDs de party e venda de pacote (`partyId`, `packageSaleId`);
  - aliases de nome de pacote em `package_sell_to_party`.
- Cobertura de regressão:
  - novo [`business-action-presets.packages-encounters.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.packages-encounters.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) com cenários de pacote/atendimento.

### Checklist (fechado)

- [x] Actions de pacote/atendimento publicam contrato de input explícito no preset.
- [x] Normalização por `actionId` cobre aliases críticos da vertical.
- [x] Testes unitários cobrem contrato + normalização de `packages_encounters`.

**Próximo loop em aberto recomendado após o Loop 103:** **Loop 104 — vertical Services/Sales (contrato explícito das actions de serviço/venda + aliases seguros mínimos)**.

<a id="loop-104-fechado--vertical-services-sales-contrato-explicito-e-normalizacao-segura"></a>

## Loop 104 (fechado) — Vertical Services/Sales: contrato explícito + normalização segura

- **Objetivo do slice:** fechar a vertical `services_sales` com contratos explícitos nas actions de catálogo/pedido e aliases seguros de identificação comercial no boundary.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - `inputSchema` + `requiredFieldLabels` para:
    - `service_catalog_create_item`,
    - `service_catalog_list_items`,
    - `sales_create_service_order`,
    - `sales_add_service_item`,
    - `sales_mark_order_paid`,
    - `sales_get_customer_purchase_history`,
    - `sales_top_services`,
    - `sales_total_paid_by_service`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - aliases seguros para `name` em catálogo de serviços;
  - aliases para `partyId` em criação/histórico de pedidos;
  - aliases para `orderId` em adicionar item / marcar pedido pago.
- Cobertura de regressão:
  - novo [`business-action-presets.services-sales.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.services-sales.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) com cenários de serviço/venda.

### Checklist (fechado)

- [x] Actions de serviços/vendas publicam contrato explícito no preset.
- [x] Normalização por `actionId` cobre aliases críticos da vertical.
- [x] Testes unitários cobrem contrato + normalização da vertical.

**Próximo loop em aberto recomendado após o Loop 104:** **Loop 105 — vertical Github Ops (contrato explícito das actions GitHub + aliases seguros mínimos)**.

<a id="loop-105-fechado--vertical-github-ops-contrato-explicito-e-normalizacao-segura"></a>

## Loop 105 (fechado) — Vertical Github Ops: contrato explícito + normalização segura

- **Objetivo do slice:** fechar a vertical `github_ops` com contratos explícitos nas actions de PR/issue e aliases seguros para campos de owner/repo/comment no boundary.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - `inputSchema` + `requiredFieldLabels` para:
    - `github_read_pr`,
    - `github_read_diff`,
    - `github_comment_pr`,
    - `github_list_changed_files`,
    - `github_get_issue`.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - aliases seguros para `owner` e `repo` em todas as actions GitHub;
  - aliases para `body` em `github_comment_pr`.
- Cobertura de regressão:
  - novo [`business-action-presets.github-ops.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.github-ops.test.ts);
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) com cenários GitHub Ops.

### Checklist (fechado)

- [x] Actions GitHub publicam contrato explícito no preset.
- [x] Normalização por `actionId` cobre aliases críticos de owner/repo/comment.
- [x] Testes unitários cobrem contrato + normalização da vertical.

**Próximo loop em aberto recomendado após o Loop 105:** **Loop 106 — vertical Clinical deepening (schemas de conteúdo estruturado + normalização de campos clínicos compostos)**.

<a id="loop-106-fechado--clinical-deepening-schema-estruturado-e-normalizacao-composta"></a>

## Loop 106 (fechado) — Clinical deepening: schema estruturado + normalização composta

- **Objetivo do slice:** aprofundar a vertical `clinical` com contrato estruturado para anamnese e normalização segura de campos compostos de evolução.

### Entregas (resumo)

- [`business-action-presets.ts`](../../backend/src/modules/business-tools/application/business-action-presets.ts):
  - `clinical_create_anamnesis` passou a expor `content` com propriedades clínicas explícitas (`chiefComplaint`, `history`, `assessment`, `plan`, `tags`);
  - adicionado `slotFillingPromptHint` clínico para coleta de `careSubjectId` antes da estrutura de conteúdo.
- [`business-action-input-normalization.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.ts):
  - `clinical_add_evolution_note` passa a normalizar aliases de texto para `body` (`note`, `evolutionNote`, `observacao`) além de `careSubjectId`.
- Cobertura de regressão:
  - extensão de [`business-action-presets.clinical.test.ts`](../../backend/src/modules/business-tools/application/business-action-presets.clinical.test.ts) para validar `content` estruturado + hint;
  - extensão de [`business-action-input-normalization.test.ts`](../../backend/src/modules/business-tools/application/business-action-input-normalization.test.ts) para alias de nota clínica.

### Checklist (fechado)

- [x] `clinical_create_anamnesis` publica estrutura clínica mínima explícita em `content`.
- [x] `clinical_add_evolution_note` normaliza aliases compostos para `body`.
- [x] Testes unitários cobrem schema estruturado + normalização clínica.

**Próximo loop em aberto recomendado após o Loop 106:** **Loop 107 — vertical Platform/Admin (contrato explícito das actions de administração + aliases seguros mínimos)**.

---


<a id="loop-95-candidato--polimento-ui-padrão-e-responsivo-da-operação"></a>

## Loop 95 (candidato) — Polimento UI padrão e responsivo da operação

- **Etapa / prioridade:** média  
- **Objectivo do slice:** consistência visual e responsiva nas superfícies operacionais (Builder avançado, cockpit, console, runs).  
- **Foco:** cards/drawers/CTA; estados `ready`/`attention`/`blocked` claros.  
- **Critério de saída:** desktop/tablet/mobile usáveis nas rotas operacionais; gate + ledger.  
- **Escopo Ralph:** polimento; **não** reabrir funcionalidades core já cobertas nos 88–95.

---

# Decisão de manutenção documental

## Não criar terceira fonte oficial

Continuar com (em **`docs/RALPHLOOP/`**):

- `docs/RALPHLOOP/agents-team-crafter-plano-evolucao.md` = plano mestre
- `docs/RALPHLOOP/agents-team-crafter-plano-evolucao_IMPLEMENTADO.md` = ledger oficial

Qualquer detalhamento adicional deve entrar como:

- anexo temporário
- proposal
- ADR

e depois ser consolidado nesses dois arquivos.
