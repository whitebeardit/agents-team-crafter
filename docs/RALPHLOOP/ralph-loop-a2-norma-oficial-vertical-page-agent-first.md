# Ralph Loop A.2 — Norma oficial de vertical page (agent-first GOLD)

## Status

**Fechado (implementado neste ciclo)** — norma oficial reutilizável para qualquer vertical de produto agent-first.

---

## Objetivo do slice

Padronizar a estrutura e o comportamento mínimo de uma vertical page para que todas as verticais ofereçam a mesma experiência de entrada operacional via time/especialistas.

---

## Escopo normativo (obrigatório)

Toda vertical page **deve** conter os blocos abaixo, nesta ordem lógica de leitura:

1. **Cabeçalho claro**
   - título da vertical
   - descrição curta do domínio

2. **Resumo do domínio**
   - o que essa vertical resolve
   - quais entidades de negócio impacta

3. **Health / Readiness / Gold-gate**
   - estado atual (`ready`, `attention`, `blocked`)
   - motivo objetivo do estado
   - próxima ação sugerida

4. **Time operacional recomendado**
   - time principal da operação
   - coordenador responsável

5. **Especialista do domínio em destaque**
   - nome/role do especialista
   - responsabilidade explícita

6. **CTA principal único (agent-first)**
   - texto padrão recomendado: **Operar via especialistas**
   - ação deve abrir conversa no contexto da vertical

7. **Starter prompts**
   - 3 a 5 prompts úteis e acionáveis
   - linguagem de negócio (não técnica)

8. **Fallback / auditoria / troubleshooting**
   - caminho manual de contingência
   - link para auditoria/troubleshooting

---

## Contrato mínimo de dados (view model)

Toda vertical deve disponibilizar (API/BFF/compose) um view model equivalente a:

- `verticalId`
- `title`
- `summary`
- `readiness.status`
- `readiness.reason`
- `readiness.nextAction`
- `recommendedTeam.id`
- `recommendedTeam.name`
- `recommendedTeam.coordinator`
- `featuredSpecialist.id`
- `featuredSpecialist.name`
- `featuredSpecialist.role`
- `primaryCta.label`
- `primaryCta.action`
- `starterPrompts[]`
- `fallback.action`
- `audit.action`

---

## Critérios de aceite (Definition of Done do slice)

A vertical só passa no padrão A.2 quando:

- [x] apresenta os 8 blocos obrigatórios da norma.
- [x] exibe estado de readiness legível por utilizador final.
- [x] deixa explícito o time recomendado e o especialista de domínio.
- [x] mantém CTA principal único orientado a operação via agentes.
- [x] fornece starter prompts úteis para início imediato.
- [x] oferece fallback/auditoria sem competir com o fluxo principal.

---

## Template canónico (copiar/colar por vertical)

```md
# <Vertical>

## Resumo
<explicação curta do domínio>

## Estado da vertical
- Status: <ready|attention|blocked>
- Motivo: <motivo objetivo>
- Próxima ação: <ação sugerida>

## Time recomendado
- Time: <nome>
- Coordenador: <nome>
- Especialista em destaque: <nome/role>

## Operar via especialistas
- CTA principal: Operar via especialistas

## Prompts iniciais
1. <prompt 1>
2. <prompt 2>
3. <prompt 3>

## Fallback e auditoria
- Fallback: <ação manual>
- Auditoria/troubleshooting: <link/ação>
```

---

## Não-objetivos

- Não redefine contratos internos de runtime/tooling por domínio.
- Não substitui critérios de E2E/GOLD gate do Loop G.
- Não força UI idêntica pixel a pixel; força **moldura funcional única**.

---

## Próximo gap/loop recomendado

**Loop A.3 — Norma oficial de operation team page** (deixar explícito que o centro do produto é o time da operação, com coordenador, especialistas por domínio, entidades partilhadas e readiness do time).
