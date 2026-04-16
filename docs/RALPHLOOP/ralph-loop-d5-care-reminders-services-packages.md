# Ralph Loop D.5 — Care / Reminders / Services / Packages

## Status

**Fechado (implementado neste ciclo)** — formalização das verticais remanescentes da fase D no padrão GOLD agent-first.

---

## Objetivo do slice

Fechar Care, Reminders, Services e Packages numa moldura única agent-first, com especialista explícito, time recomendado, prompts úteis e operação auditável por domínio.

---

## Estratégia canónica (entrega em grupos)

1. **Care + Reminders**
   - continuidade de cuidado
   - lembretes proativos
   - gestão de aderência e retorno

2. **Services + Packages**
   - catálogo de serviços/pacotes
   - conversão comercial assistida
   - gestão de oferta ativa

3. **Governança transversal**
   - readiness por vertical
   - fallback + auditoria por domínio
   - CTA principal para operar via especialistas

---

## Estrutura mínima obrigatória por vertical (D.5)

Cada vertical (Care, Reminders, Services, Packages) deve explicitar:

- `readiness.status`, `readiness.reason`, `readiness.nextAction`
- `featuredSpecialist`
- `recommendedTeam`
- `primaryCta`
- `starterPrompts[]` (mínimo 3 por vertical)
- `fallbackAction`
- `auditAction`
- `mainJourneys[]`

---

## Prompts canónicos (base D.5)

### Care
1. "Quero priorizar pacientes sem continuidade de cuidado nos últimos 14 dias."
2. "Quero sugerir plano de follow-up para pacientes de maior risco."
3. "Quero revisar casos críticos com responsável e próximo passo."

### Reminders
1. "Quero disparar lembretes de consulta para amanhã com confirmação."
2. "Quero listar lembretes não entregues e sugerir fallback."
3. "Quero otimizar o horário de envio por taxa de resposta."

### Services
1. "Quero destacar serviços com maior conversão da semana."
2. "Quero identificar serviços com baixa procura e sugerir ação."
3. "Quero montar oferta recomendada por perfil de cliente."

### Packages
1. "Quero listar pacotes com renovação pendente nos próximos 7 dias."
2. "Quero identificar pacotes subutilizados por cliente."
3. "Quero sugerir upgrade de pacote por padrão de consumo."

---

## Critérios de aceite (Definition of Done do slice)

O D.5 é considerado atendido quando:

- [x] as 4 verticais (Care/Reminders/Services/Packages) possuem moldura mínima agent-first.
- [x] cada vertical tem especialista e time recomendado explícitos.
- [x] cada vertical possui prompts iniciais acionáveis.
- [x] fallback/auditoria estão definidos por domínio.
- [x] jornadas principais de cada vertical estão formalizadas para validação operacional.

---

## Template canónico de bloco (exemplo reutilizável)

```yaml
vertical: care
readiness:
  status: almost_ready
  reason: "Falta validar continuidade em pacientes de alto risco"
  nextAction: "Executar smoke da vertical no time recomendado"
featuredSpecialist: especialista_care_continuidade
recommendedTeam: time_operacao_cuidado
primaryCta: operar_via_especialistas_vertical
starterPrompts:
  - "Quero priorizar pacientes sem continuidade de cuidado nos últimos 14 dias."
  - "Quero sugerir plano de follow-up para pacientes de maior risco."
  - "Quero revisar casos críticos com responsável e próximo passo."
fallbackAction: abrir_fluxo_manual_vertical
auditAction: abrir_auditoria_vertical
mainJourneys:
  - monitor
  - intervene
  - follow_up
```

---

## Não-objetivos

- Não cobre ainda padronização visual completa de UX/UI (Loop E).
- Não substitui gates transversais do AI Builder.
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop E.1 — Sistema visual único das verticais** (unificar linguagem visual e interação entre todas as páginas de operação).
