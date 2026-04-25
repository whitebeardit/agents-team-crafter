
# Ralph Loop — Plano revisado e incremental

## Capability model explícito + CRM GOLD + preparação correta para Scheduling GOLD

## Contexto

A `main` já está numa fase em que o foco oficial mudou para **produto GOLD por vertical**, começando por **CRM** e seguindo depois para **Scheduling, Finance, Clinical, Packages & Encounters, Care...** O documento oficial do roadmap já estabelece isso claramente.

Ao mesmo tempo, o código já tem sinais fortes de evolução na direção correta:

* `business-action-presets.ts` já centraliza semântica rica de actions (`inputSchema`, `requiredFieldLabels`, `examples`, `slotFillingPromptHint`) 
* `BusinessToolRegistry` já expõe isso em catálogo HTTP para UI/runtime 
* `ensureInternalActionDefinitions` já converte `actionId` em `WorkspaceToolDefinition` com schema canônico 
* o planner já parou de inferir `internal_actions` stub como caminho principal de negócio 
* a UI do `TeamAiBuilder` ainda está muito centrada em `catalogTools`, o que reforça uma modelagem mais técnica do que semântica.

## Problema que este plano resolve

Hoje o produto ainda corre dois riscos:

1. **ensinar modelagem errada** na UI, dando destaque excessivo a tools cruas;
2. **contaminar primitives reutilizáveis** com regras verticais, especialmente em Scheduling.

Exemplo do erro que **não** podemos cometer:

* colocar “precisa pacote elegível” dentro da primitive universal de agendamento

Isso destruiria o reuso da plataforma.

---

# Modelo alvo explícito desta evolução

## 1. Primitive tools

São ferramentas universais, reaproveitáveis, sem regra vertical embutida.

Exemplos:

* scheduling universal
* lookup genérico
* envio de email
* integração calendário
* geração de imagem
* leitura/escrita genérica de ação interna

### Regra obrigatória

Primitive tool **não** conhece:

* pacote clínico
* política de psicologia
* regra de convênio
* elegibilidade da vertical
* saldo de sessão
* vínculo específico de negócio

Ela conhece apenas invariantes universais.

---

## 2. Domain policy / guard layer

É a camada que decide **pré-condições de domínio**.

Exemplos:

* para esta vertical, antes de agendar precisa existir CRM?
* para esta vertical, precisa pacote elegível?
* para esta vertical, atendimento exige agendamento válido?
* cancelamento devolve reserva?
* remarcação move reserva?

### Regra obrigatória

Essa camada **não substitui** a primitive.
Ela decide se a primitive pode ser usada naquele contexto.

### Forma incremental adotada neste plano

Não vamos abrir um mega framework genérico de `domain-policies` logo de início.

Vamos começar com:

* `guardProfileId`
* catálogo leve de guard profiles
* enforcement gradual por action composta

Ou seja:
**guard profile = primeira camada prática de policy**

---

## 3. Composite business actions

São ações semânticas de negócio que:

* recebem intenção mais próxima do domínio
* avaliam policies/guards
* usam primitives por baixo
* persistem vínculos de negócio
* registram auditoria

Exemplos:

* `clinic_schedule_session`
* `clinic_reschedule_session`
* `clinic_cancel_session`
* `clinic_register_attendance`
* `clinic_bill_session`

### Regra obrigatória

Se uma operação de negócio exige:

* CRM
* pacote
* care subject
* contexto clínico
* vínculo de atendimento

isso deve viver em **composite action + policy/guard**, e **não** na primitive universal.

---

# Regra de ouro

**Quanto mais universal a tool, menos regra de domínio dentro dela.**
**Quanto mais crítica a regra para a vertical, mais ela deve viver em guard/policy/composite action.**

---

# Regras Ralph de execução

## Regra 1 — um slice por vez

Não misturar slices.

## Regra 2 — gate obrigatório

### Backend

```bash id="vqx3gs"
cd backend && npm run build && npm test
```

### Frontend

```bash id="ysuu7t"
cd v0-team-ai-crafter && npm run build
```

### Quando tocar ponta a ponta

```bash id="j0k1i4"
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

## Regra 3 — backward compatibility obrigatória

Nada de quebrar:

* planos antigos
* snapshots existentes
* AI Builder
* bind preview
* import/export

## Regra 4 — não antecipar framework gigante

Só generalizar depois que o padrão estiver validado no CRM e na entrada do Scheduling GOLD.

---

# Objetivo macro

## Ao final desta trilha

1. o produto mostra melhor a semântica de negócio
2. CRM continua sendo a primeira vertical GOLD de referência
3. Scheduling entra no roadmap do jeito certo
4. primitives continuam reaproveitáveis
5. a base fica preparada para crescer sem mistura conceitual

---

# LOOP 120.A — Classificação semântica mínima das actions

## Objetivo

Adicionar classificação semântica mínima às business actions existentes.

## Escopo

Backend apenas.

## Arquivos-alvo

* `backend/src/modules/business-tools/application/business-action-presets.ts`
* `backend/src/modules/business-tools/application/business-tool-registry.ts`

## Mudanças obrigatórias

Expandir `TBusinessActionPreset` com campos opcionais:

* `capabilityKind?: "business_action" | "primitive_like" | "gold_gate"`
* `uiExposureMode?: "primary" | "advanced" | "hidden"`
* `domainScope?: string`
* `dependsOnCatalogTools?: string[]`
* `dependsOnActionIds?: string[]`
* `guardProfileId?: string`

Classificar:

* `*_gold_gate` → `gold_gate`
* ações de negócio → `business_action`
* qualquer primitive-like action → `primitive_like`, quando aplicável

Expor tudo no catálogo HTTP retornado pelo `BusinessToolRegistry`.

## Fora do escopo

* enforcement
* frontend
* planner

## Critérios de aceite

* build backend verde
* testes backend verdes
* catálogo continua compatível
* nenhuma action antiga quebra

## Testes obrigatórios

* unitário do catálogo
* validação de defaults
* validação de `gold_gate`

## Gate

```bash id="botkgb"
cd backend && npm run build && npm test
```

---

# LOOP 120.B — `internal_actions` como capability técnica, não capability primária

## Objetivo

Tirar `internal_actions` do protagonismo da UI.

## Escopo

Frontend apenas.

## Arquivos-alvo

* `v0-team-ai-crafter/lib/catalog-tool-ids.ts`
* `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`

## Mudanças obrigatórias

* manter `internal_actions` suportado
* trocar label para algo explicitamente técnico
* esconder do modo simples
* exibir apenas no modo avançado
* adicionar hint claro de que ações de negócio reais vêm do catálogo de actions/packs/workspace

## Fora do escopo

* backend
* persistência
* planner

## Critérios de aceite

* build frontend verde
* modo simples não destaca `internal_actions`
* modo avançado continua funcional

## Smoke manual

* abrir builder
* verificar tool list em modo simples
* alternar modo avançado
* confirmar exibição correta

## Gate

```bash id="qdw7t2"
cd v0-team-ai-crafter && npm run build
```

---

# LOOP 120.C — UI: business actions primeiro, tools depois

## Objetivo

Mostrar primeiro a semântica de negócio.

## Escopo

Frontend apenas.

## Arquivos-alvo

* `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
* tipos auxiliares consumidos pelo frontend

## Mudanças obrigatórias

Reorganizar a visualização em blocos:

1. Ações de negócio
2. Guardrails / Validações / GOLD gates
3. Ferramentas base
4. Integrações

Usar:

* `capabilityKind`
* `uiExposureMode`

Dar prioridade visual a:

* `requiredBusinessActionIds`
* capabilities primárias

## Fora do escopo

* runtime
* snapshot
* planner

## Critérios de aceite

* build frontend verde
* ações de negócio aparecem antes de `catalogTools`
* `gold_gate` aparece como validação/readiness

## Gate

```bash id="x3y06v"
cd v0-team-ai-crafter && npm run build
```

---

# LOOP 120.D — CRM como capability primária explícita

## Objetivo

Alinhar CRM com o status de vertical GOLD de referência.

## Escopo

Backend + frontend leve.

## Arquivos-alvo

* `business-action-presets.ts`
* `business-tool-registry.ts`
* `team-ai-builder.tsx`

## Mudanças obrigatórias

Marcar como `uiExposureMode: "primary"`:

* `crm_create_party`
* `crm_update_party`
* `crm_find_party`
* `crm_list_parties`
* `crm_get_party_summary`

Opcional:

* `domainScope: "crm"`
* `recommendedForTeams`

No frontend:

* destacar capabilities CRM como principal camada operacional

## Fora do escopo

* CRUD HTTP/BFF do CRM
* conversa CRM
* testes E2E de CRM

## Critérios de aceite

* build backend verde
* testes backend verdes
* build frontend verde
* CRM aparece como capability primária

## Gate

```bash id="z1l40c"
cd backend && npm run build && npm test
cd ../v0-team-ai-crafter && npm run build
```

---

# LOOP 120.E — Snapshot v2 com capability view, compatível com v1

## Objetivo

Preparar export/import para a visão semântica.

## Escopo

Frontend.

## Arquivos-alvo

* `v0-team-ai-crafter/lib/team-plan-snapshot.ts`
* import/export do builder

## Mudanças obrigatórias

Criar `schemaVersion = 2` com envelope leve:

* `plan`
* `uiCapabilityView?`
* `catalogMetadataSnapshot?`

Aceitar import de:

* v1
* v2

Defaults seguros ao importar v1.

## Fora do escopo

* alteração do team export final do backend
* migrações backend

## Critérios de aceite

* import v1 funciona
* export v2 funciona
* build frontend verde

## Smoke manual

* export v1/v2
* import v1/v2
* reabrir plano

## Gate

```bash id="x2pf4k"
cd v0-team-ai-crafter && npm run build
```

---

# LOOP 120.F — Guard profiles mínimos como primeira camada de policy

## Objetivo

Introduzir explicitamente a camada de policy de forma incremental.

## Escopo

Backend.

## Arquivos-alvo

* novo: `backend/src/modules/business-tools/application/business-action-guard-profiles.ts`
* `business-action-presets.ts`
* serviços/runtime de business actions, se necessário

## Mudanças obrigatórias

Criar catálogo leve de guard profiles:

* `guardProfileId`
* `title`
* `description`
* `appliesToActionIds`
* `rulesSummary`

Importante: este slice deve deixar explícito que:

* guard profile é a **primeira camada de policy**
* não é só metadado decorativo
* ainda não é um framework genérico grande

Criar exemplos leves:

* `crm_identity_required_for_subject_operations`
* `care_subject_context_guard`

## Fora do escopo

* scheduling clínico
* package enforcement
* framework genérico de policies

## Critérios de aceite

* build backend verde
* testes backend verdes
* actions sem guard continuam funcionando
* o código deixa clara a intenção arquitetural

## Gate

```bash id="cu8t8v"
cd backend && npm run build && npm test
```

---

# LOOP 120.G — Expor guard profiles no catálogo e na UI

## Objetivo

Fazer o produto enxergar guardrails como parte da capability.

## Escopo

Backend + frontend leve.

## Arquivos-alvo

* `business-tool-registry.ts`
* tipos frontend
* `team-ai-builder.tsx`

## Mudanças obrigatórias

Expor `guardProfileId` e, se útil, resumo do guard no catálogo HTTP.

Na UI:

* mostrar guard associado à action
* em modo simples, como resumo da regra
* em modo avançado, mais detalhe

## Fora do escopo

* enforcement real
* planner pesado

## Critérios de aceite

* build backend verde
* testes backend verdes
* build frontend verde
* a UI passa a refletir policy de domínio como parte do fluxo

## Gate

```bash id="4x9r5b"
cd backend && npm run build && npm test
cd ../v0-team-ai-crafter && npm run build
```

---

# LOOP 120.H — Planner: preferir capability semântica ao invés de tool crua

## Objetivo

Ajustar o planner para empurrar a modelagem certa.

## Escopo

Backend apenas.

## Arquivos-alvo

* `backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts`
* demais arquivos do planner que montam hints/recomendações

## Mudanças obrigatórias

Refinar hints:

* se houver `business_action` `primary`, não destacar tool técnica equivalente no modo simples
* manter fallback existente
* não quebrar `catalogTools`

## Fora do escopo

* refactor total do planner
* mudança de schema do planner output

## Critérios de aceite

* build backend verde
* testes backend verdes
* planner continua gerando planos válidos
* planos ficam semanticamente melhores

## Gate

```bash id="n7xuvb"
cd backend && npm run build && npm test
```

---

# LOOP 120.I — Documentação Ralph oficial da regra primitive / policy / composite

## Objetivo

Registrar formalmente o modelo alvo.

## Escopo

Docs apenas.

## Arquivos-alvo

* docs Ralph do Loop 120
* suplemento correspondente, se necessário

## Mudanças obrigatórias

Adicionar seção explícita com:

* primitive tools
* domain policy / guard layer
* composite business actions

Registrar formalmente:

* primitive não carrega regra vertical
* action composta + policy/guard aplica regra de domínio
* CRM continua referência GOLD
* Scheduling deve seguir esse padrão

## Critérios de aceite

* texto consistente com docs oficiais atuais
* sem contradição com o roadmap oficial 120–129

---

# LOOP 121.A — Scheduling GOLD: inventário universal da vertical

## Objetivo

Congelar o desenho correto de Scheduling antes do enforcement clínico.

## Escopo

Docs + backend leve, se necessário.

## Arquivos-alvo

* docs do Loop 121
* presets/scheduling, se já existirem

## Mudanças obrigatórias

Registrar formalmente:

* scheduling universal é reaproveitável
* trata slot/resource/start/end/status/conflict/cancel/reschedule
* não conhece pacote clínico
* não conhece regra de psicologia
* não conhece elegibilidade de pacote

## Critérios de aceite

* nenhum acoplamento clínico introduzido
* documentação pronta para a próxima etapa

---

# LOOP 121.B — Scheduling actions classificadas corretamente

## Objetivo

Refletir Scheduling como capability reutilizável.

## Escopo

Backend.

## Arquivos-alvo

* `business-action-presets.ts`
* `business-tool-registry.ts`
* arquivos do pack scheduling, se aplicável

## Mudanças obrigatórias

Classificar actions de scheduling existentes como:

* `business_action` ou `primitive_like`, conforme o caso
* `uiExposureMode`
* `domainScope`

Sem adicionar ainda:

* CRM obrigatório
* pacote obrigatório

## Critérios de aceite

* build backend verde
* testes backend verdes
* catálogo reflete scheduling como vertical reutilizável

## Gate

```bash id="mkvr42"
cd backend && npm run build && npm test
```

---

# LOOP 121.C — Composite actions clínicas de scheduling

## Objetivo

Introduzir a regra clínica no nível correto.

## Escopo

Backend.

## Arquivos-alvo

* guard profiles
* presets de actions compostas
* runtime/service de actions compostas

## Mudanças obrigatórias

Criar/fixar como composite actions:

* `clinic_schedule_session`
* `clinic_reschedule_session`
* `clinic_cancel_session`

Essas actions:

* avaliam policy/guard
* usam scheduling universal por baixo
* podem depender de CRM/package/care

O documento e o código devem deixar explícito:

* isto é **composite action da vertical**
* isto **não** é extensão da primitive universal

## Fora do escopo

* UI completa de scheduling
* framework genérico gigante de orchestration

## Critérios de aceite

* build backend verde
* testes backend verdes
* primitive continua sem regra clínica
* as pré-condições vivem no nível certo

## Testes obrigatórios

* composite action bloqueia sem pré-condição
* scheduling universal funciona sem pacote em cenário genérico

## Gate

```bash id="0phdtx"
cd backend && npm run build && npm test
```

---

# LOOP 121.D — UI do scheduling clínico como capability semântica

## Objetivo

Refletir corretamente no builder a diferença entre scheduling universal e scheduling clínico.

## Escopo

Frontend.

## Arquivos-alvo

* `team-ai-builder.tsx`
* componentes auxiliares

## Mudanças obrigatórias

No modo simples:

* destacar `clinic_schedule_session` como capability principal, quando aplicável
* manter scheduling low-level em modo avançado

Mostrar guard/policy associado.

## Critérios de aceite

* build frontend verde
* scheduling clínico aparece semântico
* tool low-level continua acessível em modo avançado

## Gate

```bash id="d7c4oi"
cd v0-team-ai-crafter && npm run build
```

---

# LOOP 121.E — Compatibilidade final e smoke completo

## Objetivo

Fechar a trilha sem regressões.

## Escopo

Backend + frontend + smoke.

## Mudanças obrigatórias

Validar:

* planos antigos
* snapshots antigos
* snapshots novos
* AI Builder
* bind preview
* plano CRM
* plano scheduling
* modo simples/avançado

## Smoke obrigatório

1. abrir plano antigo
2. abrir plano novo
3. exportar/importar snapshot v1
4. exportar/importar snapshot v2
5. revisar capability CRM
6. revisar capability scheduling
7. confirmar que `internal_actions` continua técnico/avançado
8. confirmar que composite actions aparecem antes de low-level

## Critérios de aceite

* builds verdes
* testes verdes
* smoke sem regressão crítica

## Gate final

```bash id="vsnxos"
cd backend && npm run build && npm test
cd ../v0-team-ai-crafter && npm run build
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

---

# Ordem recomendada de execução

1. 120.A
2. 120.B
3. 120.C
4. 120.D
5. 120.E
6. 120.F
7. 120.G
8. 120.H
9. 120.I
10. 121.A
11. 121.B
12. 121.C
13. 121.D
14. 121.E

---

# Instrução final para o Cursor

Para cada slice:

* tocar só os arquivos do escopo
* não antecipar o próximo slice
* garantir gate verde antes de encerrar
* se surgir dívida fora do escopo, registrar como nota
* preservar compatibilidade
* não colocar regra vertical em primitive universal
* usar `guardProfile` como primeira camada concreta de policy
* usar composite actions para a vertical clínica

---

# Resumo executivo final

Esta versão revisada do Ralph Loop passa a endereçar explicitamente o ponto central do anexo:

* **primitive tools** continuam genéricas
* **domain policy/guard layer** passa a existir de forma incremental e explícita
* **composite business actions** passam a ser o lugar correto da lógica da vertical
* CRM continua sendo a vertical GOLD de referência
* Scheduling entra depois, mas do jeito certo, preservando reuso da plataforma e evitando acoplamento clínico indevido.
