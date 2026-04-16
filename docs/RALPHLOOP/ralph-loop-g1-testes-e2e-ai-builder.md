# Ralph Loop G.1 — Testes E2E do AI Builder

## Status

**Fechado (implementado neste ciclo)** — formalização da cobertura E2E mínima do fluxo principal do AI Builder.

---

## Objetivo do slice

Proteger ponta a ponta o fluxo de criação assistida no AI Builder, reduzindo regressões em etapas críticas de descoberta, geração de plano e execução.

---

## Caminhos E2E mínimos obrigatórios

1. **Entrevista guiada**
   - recolha das informações essenciais
   - validação de campos obrigatórios

2. **Briefing suficiente**
   - gate de suficiência aprovado
   - diagnóstico legível quando insuficiente

3. **Geração de plano**
   - plano operacional criado com estrutura válida
   - saída sem erro crítico de composição

4. **Adequação válida**
   - gate de adequação aplicado
   - ação corretiva sugerida quando necessário

5. **Execução de plano**
   - execução iniciada com time/especialistas esperados
   - estado final rastreável (sucesso/atenção)

---

## Contrato mínimo de evidência E2E

- `e2e.builder.interview.status`
- `e2e.builder.briefing.status`
- `e2e.builder.planGeneration.status`
- `e2e.builder.planAdequacy.status`
- `e2e.builder.planExecution.status`
- `e2e.builder.durationMs`
- `e2e.builder.failurePoint` (quando aplicável)
- `e2e.builder.lastRunAt`

---

## Critérios de aceite (Definition of Done do slice)

O G.1 é considerado atendido quando:

- [x] existe roteiro E2E cobrindo os 5 caminhos mínimos do builder.
- [x] falha em qualquer etapa crítica interrompe aprovação do fluxo.
- [x] evidência mínima de execução é registrada para auditoria.
- [x] o fluxo principal fica protegido contra regressões óbvias.

---

## Exemplo canónico (resultado E2E)

```yaml
e2e:
  builder:
    interview:
      status: pass
    briefing:
      status: pass
    planGeneration:
      status: pass
    planAdequacy:
      status: pass
    planExecution:
      status: pass
    durationMs: 8420
    failurePoint: null
    lastRunAt: "2026-04-16T00:00:00Z"
```

---

## Não-objetivos

- Não cobre ainda toda a matriz E2E de verticais (G.2).
- Não substitui o GOLD gate oficial por vertical (G.3).
- Não substitui suites técnicas profundas por módulo.

---

## Próximo gap/loop recomendado

**Loop G.2 — Testes E2E das verticais principais** (CRM, Scheduling, Finance e Clinical com regressão funcional de produto).
