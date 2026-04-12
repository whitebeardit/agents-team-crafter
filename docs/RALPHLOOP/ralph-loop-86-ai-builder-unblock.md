# Ralph Loop 86 — AI Builder: destravar execute, bind review proporcional e workflow ownership explícito

## Contexto

O repositório já avançou bastante nos Loops 77–85. A base atual está boa:

- o planner já expõe metadados por agente:
  - `workflowKey`
  - `requiredBusinessActionIds`
  - `requiredPackIds`
- o backend já tem modo de bind `per_agent`
- o preview de bind já existe
- a UX do AI Builder já foi simplificada em parte

Mas ainda existe um problema real de produto:

1. o botão **Executar plano** continua bloqueando mais do que deveria
2. a revisão de bind ainda está mais rígida do que o necessário
3. o sistema ainda mascara duplicidade de workflow entre especialistas, em vez de tratá-la como erro de desenho do time
4. a inferência de built-ins ainda pode poluir especialistas quando o plano não vier suficientemente específico

## Diagnóstico factual do código atual

### 1. O botão “Executar plano” ainda depende de um gate demasiado amplo
No `TeamAiBuilder`, o botão fica desabilitado quando:

- `isExecuting`
- `isBindPreviewLoading`
- há colisão de `SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS`
- `requiresBindReview && (!bindPreview || !bindPreviewApproved)`
- overlap blocking com conflitos

Hoje `requiresBindReview` vem de `planHasBindReviewHints(plan)`, que só olha para:

- `requiredPacks`
- `requiredTools`
- `requiredBusinessActionIds`
- `requiredPackIds`

Problema:
isso significa que **a mera presença de hints** já obriga preview + aprovação manual, mesmo quando:

- o preview não tem ações reais para aplicar
- o bind efetivo está vazio
- a política do workspace implica comportamento não bloqueante
- o preview está atualizado e sem risco real

### 2. O frontend ignora o campo backend `preview.requiresExplicitApproval`
O backend já calcula `preview.requiresExplicitApproval`.

Mas a UI ainda usa a heurística mais grosseira:
- `planHasBindReviewHints(plan)`

Em vez de usar a informação mais precisa vinda do preview real.

### 3. O refresh do preview sempre derruba aprovação
Hoje `refreshBindPreview()` faz:

- `setBindPreviewApproved(false)`

sempre.

E `saveEdits()` sempre chama `refreshBindPreview()`.

Resultado:
mesmo quando o utilizador muda algo pequeno ou salva um estado compatível, a aprovação vai a `false` e o botão volta a travar.

### 4. O ownership de workflow ainda está “disfarçado”, não validado de verdade
Em `planner-workflow-ownership.ts`, a função `ensurePlannerAgentWorkflowKeys()`:

- gera `workflowKey` se estiver vazio
- e, se houver duplicidade, adiciona sufixos:
  - `__1`
  - `__2`

Isso evita colisão técnica, mas **mascara erro de desenho do time**.

Pela regra de produto:
- no mesmo time, só pode existir **um especialista dono de cada workflow/domínio**
- duplicidade só pode existir em outro time, outro workflow ou outro workspace

Portanto, a duplicidade de workflow no mesmo team plan deve:
- ser detectada
- ser reparada pela IA no fluxo gerado
- e ser bloqueada em edição manual persistida

### 5. A inferência de built-ins ainda pode poluir especialistas com hints globais
No `planner-agent-catalog-tools.ts`, a função `inferCatalogPackContextLower()` faz:

- para coordenador: usa `requiredPacks` globais
- para especialista:
  - usa `requiredPackIds` do agente, se existirem
  - senão cai para `requiredPacks` globais

Isso ainda pode fazer um especialista “herdar” hints globais e ganhar:

- `internal_actions`
- `calendar_access`

mesmo sem necessidade real do seu workflow.

Se um plano tiver packs globais e nem todos os agentes vierem com `requiredPackIds`, ainda existe risco de poluição por fallback.

---

# Objetivo do Loop 86

Corrigir de forma coerente e incremental os problemas acima, com foco em:

1. **destravar o execute quando não houver blocker real**
2. **usar revisão de bind proporcional ao risco real**
3. **tratar duplicidade de workflow como erro de desenho, não como detalhe técnico mascarado**
4. **reduzir poluição de built-ins por fallback de packs globais**

---

# Escopo deste loop

## Incluído
- backend:
  - validação explícita de ownership de workflow
  - ajuste da heurística de bind review
  - redução de poluição na inferência de built-ins
- frontend:
  - usar `bindPreview.requiresExplicitApproval`
  - preservar aprovação quando preview continuar compatível
  - desbloquear o botão de execute quando não houver blocker real
  - melhorar copy de estado do preview
- docs:
  - atualizar plano mestre e ledger com Loop 86

## Fora do escopo
- redesign completo do AI Builder
- trocar o fluxo de preview por wizard em múltiplos passos
- reabrir ETAPA 8
- mexer em templates, scheduling, billing ou 2FA

---

# Resultado esperado ao final

Ao final deste loop:

1. o botão **Executar plano** só ficará bloqueado quando houver blocker real
2. o utilizador não precisará reaprovar o preview à toa
3. duplicidade de workflow entre especialistas no mesmo time será tratada como conflito real
4. built-ins por fallback ficarão mais conservadoras
5. a UX ficará mais fácil sem perder segurança

---

# Implementação técnica detalhada

## 1. Backend — workflow ownership real

### Criar um validador explícito de workflow uniqueness
Criar:

- `backend/src/modules/team-planning/domain/planner-workflow-uniqueness.ts`

Responsabilidade:
- verificar workflows de especialistas no mesmo plano
- ignorar coordenador
- comparação case-insensitive
- retornar conflitos legíveis

Exemplo de API:
```ts
export interface IPlannerWorkflowConflict {
  workflowKey: string
  specialistNames: string[]
}

export function getSpecialistWorkflowConflicts(
  agents: ReadonlyArray<{ role: string; name: string; workflowKey?: string }>
): IPlannerWorkflowConflict[]

export function assertSpecialistWorkflowOwnership(
  agents: ReadonlyArray<{ role: string; name: string; workflowKey?: string }>
): void
```

### Ajustar `planner-workflow-ownership.ts`
Hoje ele sufixa duplicatas com `__1`, `__2`.

Mudar a regra:

- se `workflowKey` vier vazio:
  - pode derivar de `category`
- se houver duplicidade entre especialistas:
  - **não resolver silenciosamente com sufixo**
  - deixar o conflito ser tratado no fluxo do planner / validação

Ou seja:
- `ensurePlannerAgentWorkflowKeys()` deve apenas normalizar/gerar faltantes
- não deve “esconder” colisão real

### Ajustar `team-plan.service.ts`
Nos fluxos:
- `createPlan()`
- `updatePlan()`
- `executePlan()`

aplicar:
- `assertSpecialistWorkflowOwnership(...)`

No fluxo de geração por IA:
- se houver conflito de workflow:
  - usar o mesmo padrão do Loop 80
  - incluir isso no ciclo de reparo do planner

No fluxo manual (`PUT`):
- devolver `400 VALIDATION_ERROR`

### Ajustar `team-plan-planner-prompt.ts`
Reforçar no prompt:
- um especialista por workflow
- não duplicar workflow entre especialistas
- se dois papéis parecerem no mesmo domínio, fundir ou repartir melhor

### Ajustar `team-plan-planner-output.schema.ts`
Manter:
- `workflowKey`
- `requiredBusinessActionIds`
- `requiredPackIds`

Mas agora alinhado à nova validação.

---

## 2. Backend — bind review proporcional ao risco real

### Ajustar `buildBindPreview()` / preview contract
O backend já calcula:
- `requiresExplicitApproval`

Manter isso como a fonte oficial.

Mas melhorar a semântica:

`requiresExplicitApproval` deve ser `true` apenas quando houver risco real de bind, por exemplo:
- `selectedActionIds.length > 0`
ou
- haverá criação/reativação/vínculo real de tool definitions
ou
- existe delta relevante de override

Evitar depender só de `actionIdsFull.length > 0` se isso gerar falso positivo.

Revisar a melhor condição. Uma sugestão aceitável:
```ts
const requiresExplicitApproval =
  selectedActionIds.length > 0 ||
  toolDefinitions.some((d) => d.plannedOperation === 'create' || d.plannedOperation === 'reactivate') ||
  bindOverridesApplied
```

### Garantir que `preview.requiresExplicitApproval` reflita a verdade operacional
Esse campo precisa ser o contrato definitivo para o frontend.

---

## 3. Frontend — botão Execute menos rígido

### Ajustar `TeamAiBuilder`
Arquivo:
- `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`

Hoje a UI usa:
- `requiresBindReview = planHasBindReviewHints(plan)`

Mudar para algo assim:

### regra nova
- usar `bindPreview?.requiresExplicitApproval` como fonte primária
- usar `planHasBindReviewHints(plan)` apenas enquanto o preview ainda não foi carregado
- se o preview existir e disser que não precisa aprovação explícita, o botão pode habilitar

Exemplo de ideia:
```ts
const requiresExplicitBindApproval =
  bindPreview?.requiresExplicitApproval ??
  (bindPreview ? false : planHasBindReviewHints(plan))
```

E no `disabled` do botão:
```ts
(requiresExplicitBindApproval && !bindPreviewApproved)
```

em vez da regra atual ampla.

### Ajustar `executePlan()`
Hoje ele também faz:
```ts
if (requiresBindReview && (!bindPreview || !bindPreviewApproved)) ...
```

Aplicar a mesma regra nova:
- travar apenas quando houver aprovação realmente exigida

---

## 4. Frontend — preview approval não pode cair à toa

### Ajustar `refreshBindPreview()`
Hoje ele sempre faz:
- `setBindPreviewApproved(false)`

Mudar para algo mais inteligente.

### Comportamento desejado
Quando o preview novo for compatível com o anterior, manter aprovação.

Sugestão:
- criar um “preview approval fingerprint” leve, baseado em:
  - `requiresExplicitApproval`
  - `autoBindActionsApplied`
  - `toolDefinitions` com `plannedOperation`
  - `agents[].actionIdsToLink`

Se o fingerprint mudar, limpar aprovação.
Se não mudar, manter.

Exemplo:
- criar helper:
  - `v0-team-ai-crafter/lib/team-plan-bind-preview-fingerprint.ts`

### Ajustar `saveEdits()`
Hoje sempre salva e sempre derruba a aprovação por causa do refresh.

Quero:
- preservar a aprovação quando o preview novo for semanticamente o mesmo
- continuar invalidando quando o bind realmente mudou

---

## 5. Frontend — estados mais claros no review

### Melhorar a copy do card de preview
No card “Preview de bind”, explicar claramente um destes estados:
- “não há bind real pendente”
- “há bind real pendente e precisa aprovação”
- “preview está desatualizado”
- “há blockers de governança”
- “há colisão de workflow”
- “há colisão de built-in exclusiva”

### Mostrar por que o botão está desabilitado
Adicionar uma lista resumida de blockers reais acima do CTA, por exemplo:

- `workflow duplicado entre especialistas`
- `preview de bind ainda não aprovado`
- `conflitos de overlap em modo blocking`

Sem isso, o utilizador sente “está travado” sem entender por quê.

---

## 6. Backend — reduzir poluição por packs globais na inferência de built-ins

### Ajustar `planner-agent-catalog-tools.ts`
Hoje `inferCatalogPackContextLower()` ainda pode fazer especialistas herdarem packs globais.

Tornar a regra mais conservadora:

### regra nova sugerida
Para especialistas:
- se o plano tiver qualquer hint per-agent (`requiredPackIds` ou `requiredBusinessActionIds` em algum especialista),
  então **não herdar automaticamente packs globais**
- usar apenas:
  - `requiredPackIds` do próprio agente
  - ou nenhum pack hint, se estiver vazio

Para coordenador:
- pode continuar usando packs globais

### efeito esperado
- menos `internal_actions` e `calendar_access` indevidos
- menos colisão artificial entre especialistas
- menos ruído no AI Builder

---

# Critérios de aceite

## Backend
- duplicidade de workflow entre especialistas não é mais mascarada com sufixo automático silencioso
- `createPlan()` gerado por IA consegue reparar conflito de workflow
- `updatePlan()` manual falha com 400 quando houver duplicidade de workflow
- `preview.requiresExplicitApproval` falso quando não houver bind real pendente
- inferência de built-ins não polui especialistas por fallback global desnecessário

## Frontend
- botão **Executar plano** habilita quando não houver blocker real
- preview não perde aprovação por edições cosméticas compatíveis
- UI usa `bindPreview.requiresExplicitApproval`
- utilizador entende claramente por que o botão está bloqueado quando estiver

## Produto
- UX fica mais fácil
- menos sensação de “travou”
- menos tools erradas em agentes
- regra de um especialista por workflow fica realmente visível no comportamento do sistema

---

# Testes obrigatórios

## Backend
Adicionar ou expandir testes em:

- `backend/src/modules/team-planning/domain/planner-workflow-uniqueness.test.ts`
- `backend/src/__tests__/team-plans.integration.test.ts`
- `backend/src/__tests__/team-plan-auto-bind.integration.test.ts`
- `backend/src/modules/team-planning/application/planner-agent-catalog-tools.test.ts`

Cobrir:
- workflow duplicado em `POST /team-plans` reparado pela IA
- workflow duplicado em `PUT /team-plans/:id` retornando 400
- `preview.requiresExplicitApproval` falso quando não houver bind real pendente
- inferência de built-ins sem herança global indevida para especialistas

## Frontend
Se houver testes de componente, adicionar.
Se não houver, pelo menos garantir:
- `next build`
- smoke manual do AI Builder

Cenários manuais obrigatórios:
1. plano com hints mas sem bind real → botão deve habilitar sem aprovação manual desnecessária
2. plano com bind real → botão deve exigir aprovação
3. salvar edição cosmética → aprovação deve permanecer quando preview equivalente
4. dois especialistas no mesmo workflow → erro claro / bloqueio claro

---

# Gate Ralph obrigatório

Executar:

```bash
./scripts/ralph-loop-gate.sh
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

Se o projeto tiver smoke manual documentado do AI Builder, executar também.

---

# Atualização documental obrigatória ao fechar

Ao final do loop, atualizar:

1. `docs/RALPHLOOP/agents-team-crafter-plano-evolucao.md`
2. `docs/RALPHLOOP/agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`

## O que registrar
- Loop 86 como fechado
- diagnóstico corrigido
- decisão sobre workflow uniqueness
- decisão sobre `requiresExplicitApproval`
- decisão sobre preservação de aprovação do preview
- impacto na UX do AI Builder

---

# Restrições

- não reabrir ETAPA 8
- não criar novo plano oficial
- não redesenhar o AI Builder inteiro
- não misturar billing/2FA/self-service neste loop
- manter o slice coerente e pequeno o suficiente para fechar com gate verde

---

# Ordem de implementação sugerida

1. backend — workflow uniqueness
2. backend — `requiresExplicitApproval`
3. backend — inferência de built-ins mais conservadora
4. frontend — usar `bindPreview.requiresExplicitApproval`
5. frontend — preservar aprovação quando preview equivalente
6. frontend — melhorar blockers e feedback
7. testes
8. gate
9. atualizar docs Ralph Loop

---

# Resumo executivo do loop

Este loop não é sobre reescrever nada.

É um loop de **correção fina de produto** para resolver o que hoje mais atrapalha a experiência:

- botão de execute travado demais
- bind review rígido demais
- workflow ownership pouco explícito
- built-ins poluindo agentes

A meta é simples:

> deixar o AI Builder previsível, fácil de usar e fiel ao desenho coordinator-first, com ownership claro de domínio e bind realmente por agente.
