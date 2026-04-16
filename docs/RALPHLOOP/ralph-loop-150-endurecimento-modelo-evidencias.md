# Loop 150 — Endurecimento do modelo de evidências

## Objetivo

Padronizar o registro de evidências operacionais por checkpoint para reduzir drift documental, acelerar auditoria e facilitar decisão de continuidade/escalonamento.

---

## Problema que este loop resolve

- Evidências de checkpoints podem variar de formato entre ciclos.
- Falta de padrão dificulta comparar status, risco e decisões entre semanas.
- Ledger pode ficar sem links consistentes para trilha de execução.

---

## Slices explícitos e pequenos

### Slice 150.1 — Template canónico de checkpoint

**Escopo mínimo:**
- definir um template único contendo: data/hora, item ativo, status, motivo, owner, prazo, decisão.
- incluir campo obrigatório de link para evidência anexada.

**Critério de saída do slice:**
- [ ] Template aprovado e publicado no documento oficial do loop.

---

### Slice 150.2 — Regra de preenchimento e validação mínima

**Escopo mínimo:**
- definir checklist de completude (campos obrigatórios e consistência de status/decisão);
- definir quando o checkpoint deve ser marcado como inválido para governança.

**Critério de saída do slice:**
- [ ] Checklist de validação mínima documentado e aplicável em qualquer checkpoint.

---

### Slice 150.3 — Mapeamento para ledger

**Escopo mínimo:**
- padronizar como referenciar o checkpoint no ledger (link, decisão final, ação seguinte);
- definir convenção única para evitar múltiplos formatos de referência.

**Critério de saída do slice:**
- [ ] Convenção de atualização do ledger documentada com exemplo mínimo.

---

### Slice 150.4 — Exemplo operacional completo

**Escopo mínimo:**
- publicar 1 exemplo fim-a-fim (checkpoint preenchido + revisão + entrada no ledger);
- incluir caso com status `attention` e ação corretiva.

**Critério de saída do slice:**
- [ ] Exemplo completo registrado como referência para os próximos ciclos.

---

## Critério de saída do loop

- [ ] Template canónico de checkpoint publicado.
- [ ] Checklist de validação mínima publicado.
- [ ] Convenção de atualização do ledger publicada.
- [ ] Exemplo operacional completo anexado.

---

## Próximo loop recomendado após este fechamento

**Loop 151 — Automação leve de governança:** reduzir esforço manual com um atalho/script para registrar checkpoints no formato canónico e anexar evidências sem drift.
