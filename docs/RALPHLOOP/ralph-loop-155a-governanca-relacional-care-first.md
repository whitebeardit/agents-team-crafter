# Loop 155A — Governanca relacional por produto (care-first)

## Objetivo

Aplicar o padrao Ralph Loop de governanca relacional nos produtos de negocio, iniciando por `care`, com regra canonica de identificacao:

- entrada pode chegar por `phone`;
- o runtime deve resolver `phone` para `partyId`;
- a execucao efetiva e a delegacao ao especialista devem usar `partyId` como identificador unico canonico.

---

## Escopo do loop

- Produto ativo do loop: `care`.
- Resultado esperado: padrao documental fechado para `care`, pronto para replicacao incremental nos demais produtos.

---

## Slices explicitos e pequenos

### Slice 155A.1 — Baseline do care (as-is verificavel)

**Escopo minimo:**

- mapear actions `care_*` e schemas atuais;
- mapear relacionamento com CRM (`partyId`) no modelo e repositorio;
- explicitar lacunas atuais de validacao de existencia/ownership.

**Criterio de saida do slice:**

- [x] baseline publicado com evidencias de codigo por arquivo.

**Registro no ledger (obrigatorio):**

- status do slice (`on-track|attention|blocked`);
- evidencias;
- lacunas confirmadas e impacto.

#### Baseline tecnico (as-is) — care

| Item                         | Estado atual                                                                                                                           | Evidencia                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Actions `care_*` no pack     | `care_create_patient`, `care_create_subject`, `care_update_subject`, `care_find_subject`, `care_get_subject_summary`, `care_gold_gate` | `backend/src/modules/care/application/register-care-pack.ts` |
| Relacao com CRM              | `CareSubject` referencia `partyId` com `ref: 'Party'`                                                                                  | `backend/src/modules/care/infra/care-subject.model.ts`       |
| Isolamento tenant            | consultas e writes filtram por `workspaceId`                                                                                           | `backend/src/modules/care/infra/care-subject.repository.ts`  |
| Validacao de tipo de sujeito | `subjectKind` permitido: `human`, `animal`, `psych`                                                                                    | `register-care-pack.ts` + `care-subject.model.ts`            |
| Lookup por party             | lista por `partyId` implementada (`listByParty`)                                                                                       | `care-subject.repository.ts`                                 |

#### Lacunas confirmadas no baseline (Slice 155A.1)

1. **Sem validacao explicita de existencia da party em `care_create_subject`**
   - `partyId` e recebido e persistido sem checar previamente se a `Party` existe no mesmo workspace.
2. **Sem resolucao canonica `phone -> partyId` no boundary de care**
   - o pack `care` opera com `partyId` direto; nao existe fluxo documentado/operacional para entrada por telefone.
3. **Sem regra formal de ownership party/sujeito no handoff para especialista**
   - falta checklist canonico exigindo identificador unico resolvido antes da delegacao.
4. **Cobertura de indices relacionais ainda minima para trilha longitudinal**
   - ha indice por `workspaceId` e `partyId` individuais e indice `{workspaceId, name}`, mas nao ha indice composto dedicado ao lookup longitudinal por relacionamento.

#### Impacto operacional das lacunas

- Risco de criar/associar sujeito com `partyId` invalido no fluxo de entrada.
- Risco de drift entre UX orientada por telefone e runtime orientado por `partyId`.
- Maior custo de troubleshooting para perguntas de historico ("cliente X teve evolucao Y/Z") sem trilha relacional canonica formalizada.

---

### Slice 155A.2 — Regra canonica de identificacao (`phone -> partyId`)

**Escopo minimo:**

- formalizar regra: `phone` e somente chave de busca de entrada;
- documentar resolucao obrigatoria para `partyId` antes da action de `care`;
- padronizar comportamento para ambiguidades:
  - telefone nao encontrado;
  - multiplas correspondencias;
  - party fora do workspace.

**Criterio de saida do slice:**

- [x] regra publicada com matriz de decisao para todos os cenarios de erro.

**Registro no ledger (obrigatorio):**

- decisao operacional aprovada;
- exemplos de payload de entrada e payload canonico resolvido.

#### Regra operacional canonica — `phone -> partyId` (Slice 155A.2)

1. `phone` e aceito apenas no boundary de entrada como chave de lookup.
2. Antes de qualquer action `care_*`, o runtime resolve o telefone para um unico `partyId`.
3. A execucao final no produto `care` ocorre somente com `partyId` canonico resolvido.
4. Toda resolucao precisa validar `workspaceId` para impedir cross-tenant.
5. Delegacao para especialista recebe `partyId` (e nunca `phone`) como identificador final.

#### Matriz de decisao de resolucao por telefone (Slice 155A.2)

| Cenario                                              | Resultado do lookup   | Decisao operacional | Acao obrigatoria                                                                                           |
| ---------------------------------------------------- | --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Telefone encontrado com match unico no `workspaceId` | 1 `partyId` valido    | `continuar`         | substituir entrada por payload canonico com `partyId` e seguir para action `care_*`                        |
| Telefone nao encontrado                              | 0 matches             | `bloquear`          | interromper fluxo, retornar erro de resolucao e orientar criacao/regularizacao da party antes de continuar |
| Multiplas correspondencias no mesmo `workspaceId`    | >1 match              | `bloquear`          | interromper fluxo, exigir desambiguacao explicita (`partyId`) antes da execucao                            |
| Match fora do `workspaceId` atual                    | match em outro tenant | `bloquear`          | rejeitar resolucao por ownership invalido e registrar tentativa fora do escopo do workspace                |

#### Exemplos de payload (entrada vs canonico resolvido)

**Entrada (boundary):**

```json
{
  "workspaceId": "ws-care-01",
  "phone": "79988228535",
  "action": "care_create_subject",
  "input": {
    "subjectKind": "human",
    "name": "Maria Souza"
  }
}
```

**Canonico resolvido (execucao final):**

```json
{
  "workspaceId": "ws-care-01",
  "partyId": "pty_01HTY8V3A9M2M5X7",
  "action": "care_create_subject",
  "input": {
    "subjectKind": "human",
    "name": "Maria Souza"
  }
}
```

---

### Slice 155A.3 — Pre-condicao de existencia/ownership no care

**Escopo minimo:**

- documentar que sujeito de cuidado so pode ser criado/atualizado se:
  - a party existir;
  - pertencer ao mesmo `workspaceId`;
  - o `partyId` resolvido estiver valido no contexto da operacao.

**Criterio de saida do slice:**

- [ ] checklist de pre-condicoes publicado no documento de care e no documento de runtime/tools.

**Registro no ledger (obrigatorio):**

- estado de conformidade por pre-condicao;
- riscos residuais e acao corretiva sugerida.

---

### Slice 155A.4 — Handoff coordenador -> especialista com identificador unico

**Escopo minimo:**

- definir contrato minimo de delegacao para `care`:
  - objetivo da acao;
  - `partyId` obrigatorio na execucao final;
  - `subjectId` quando aplicavel;
  - campos obrigatorios da action alvo.

**Criterio de saida do slice:**

- [ ] checklist anti-drift de handoff documentado e referenciado pelo MOC.

**Registro no ledger (obrigatorio):**

- evidencias de atualizacao das notas;
- validacao de alinhamento coordenador/especialista.

---

### Slice 155A.5 — Matriz relacional para historico longitudinal do cliente

**Escopo minimo:**

- documentar trilha canonica:
  - `phone` -> `partyId` -> `careSubjectId` -> evolucoes/anamneses/encounters;
- explicitar recomendacoes de indice e lookup por `workspaceId`;
- definir query de referencia para uso de negocio:
  - "cliente 79988228535 teve evolucao X, Y, Z".

**Criterio de saida do slice:**

- [ ] matriz relacional publicada com exemplos de consulta operacional ponta a ponta.

**Registro no ledger (obrigatorio):**

- recomendacoes de endurecimento;
- trade-offs e prioridade de implementacao futura.

---

### Slice 155A.6 — Fechamento do care-first e preparacao da fila

**Escopo minimo:**

- consolidar fechamento formal do loop;
- registrar backlog residual por produto para replicacao do padrao.

**Criterio de saida do slice:**

- [ ] checklist final do loop 155A marcado;
- [ ] proximo produto definido com owner e prazo inicial.

**Registro no ledger (obrigatorio):**

- status final do loop (`fechado` ou `parcial`);
- decisao (`continuar|replanejar|escalar`);
- proximo loop/slice priorizado.

---

## Gate de qualidade do loop

Checklist de aceite global do Loop 155A:

- [ ] regra `phone -> partyId` publicada como norma canonica de operacao.
- [ ] pre-condicoes de existencia/ownership para `care` publicadas.
- [ ] handoff para especialista com `partyId` obrigatorio documentado.
- [ ] matriz relacional de historico longitudinal publicada.
- [ ] ledger atualizado por slice com evidencias e decisao.

---

## Cadencia de execucao (Ralph)

- Checkpoint semanal por slice ativo.
- Revisao quinzenal para validar continuidade do plano e repriorizacao.
- Escalonamento automatico quando houver `blocked` por 2 checkpoints consecutivos.

---

## Template de ledger por slice

Para cada slice 155A.x, registrar:

- Slice:
- Status:
- Objetivo:
- Entregas concluidas:
- Evidencias:
- Pendencias:
- Decisao:
- Owner:
- Prazo:
- Atualizado em:

---

## Fila residual apos care-first (faltantes)

Produtos que ainda faltam adotar o mesmo padrao:

1. `services_sales`
2. `packages_encounters`
3. `clinical`
4. `finance`
5. `scheduling`
6. `reminders`
7. `github_ops` (governanca de tools)

---

## Proximo loop recomendado apos este fechamento

**Loop 155B — Governanca relacional por produto (services-sales next):**
replicar o mesmo padrao de identificacao canonica, pre-condicoes relacionais e handoff para especialista no dominio `services_sales`.
