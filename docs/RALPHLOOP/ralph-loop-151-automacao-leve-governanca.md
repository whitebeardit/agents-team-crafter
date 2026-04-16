# Loop 151 — Automação leve de governança

## Objetivo

Reduzir esforço manual e variabilidade no registro de checkpoints, disponibilizando um atalho/script que gera o bloco canónico de evidência para o ledger.

---

## O que foi implementado

- Script operacional: `scripts/ralph-loop-checkpoint-log.sh`.
- Validação mínima de campos obrigatórios (`loop`, `item`, `status`, `owner`, `prazo`, `decisao`, `motivo`).
- Geração de bloco markdown canónico com timestamp UTC.
- Suporte para anexar em ficheiro via `--output` ou imprimir no stdout.

---

## Slices explícitos e pequenos

### Slice 151.1 — CLI mínima com campos obrigatórios

**Escopo mínimo:**
- aceitar argumentos canónicos do checkpoint;
- falhar quando faltar campo obrigatório.

**Critério de saída do slice:**
- [ ] comando rejeita entradas incompletas e mostra uso.

---

### Slice 151.2 — Validação de enums operacionais

**Escopo mínimo:**
- validar `status` em `on-track|attention|blocked`;
- validar `decisao` em `continuar|replanejar|escalar`.

**Critério de saída do slice:**
- [ ] entradas inválidas são bloqueadas antes de gerar evidência.

---

### Slice 151.3 — Geração canónica de evidência

**Escopo mínimo:**
- gerar markdown padronizado com timestamp, item, status, owner, prazo, decisão e evidência.

**Critério de saída do slice:**
- [ ] saída segue estrutura única reutilizável no ledger.

---

### Slice 151.4 — Anexo direto em artefato

**Escopo mínimo:**
- suportar `--output <ficheiro.md>` para anexar checkpoint sem cópia manual.

**Critério de saída do slice:**
- [ ] checkpoint é anexado com sucesso quando output é fornecido.

---

## Exemplo de uso

```bash
scripts/ralph-loop-checkpoint-log.sh   --loop 151   --item "Padronizar checkpoint semanal"   --status attention   --owner "Ops Owner"   --prazo 2026-04-23   --decisao replanejar   --motivo "Campos incompletos em 2 times"   --evidencia "docs/evidencias/checkpoint-151.md"   --output docs/evidencias/checkpoint-151.md
```

---

## Critério de saída do loop

- [ ] Script canónico disponível em `scripts/`.
- [ ] Validação mínima de inputs obrigatórios ativa.
- [ ] Estrutura markdown padronizada para ledger.
- [ ] Fluxo de anexar evidência por `--output` funcional.

---

## Próximo loop recomendado após este fechamento

**Loop 152 — Telemetria de execução de checkpoints:** consolidar métricas operacionais (on-track/attention/blocked, frequência de bloqueio, tempo até decisão) para apoiar priorização quinzenal baseada em dados.
