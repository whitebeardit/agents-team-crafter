# Ralph Loop B.1 — Melhorar a entrevista guiada (AI Builder GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão oficial para discovery conversacional curto, humano e produtivo no AI Builder.

---

## Objetivo do slice

Transformar a entrada do AI Builder de fluxo “formulário técnico” para fluxo de **entrevista guiada por etapas**, com uma pergunta por vez, quick replies úteis e síntese progressiva do problema.

---

## Escopo normativo (obrigatório)

A entrevista guiada deve seguir os blocos abaixo:

1. **Uma pergunta por vez**
   - sem apresentar múltiplas perguntas longas no mesmo passo;
   - cada passo deve ter objetivo único de coleta.

2. **Quick replies contextuais**
   - opções curtas para reduzir atrito;
   - sempre permitir resposta livre além das opções.

3. **Ajuda contextual inline**
   - micro-ajuda por pergunta (“por que isso importa?”);
   - exemplos reais por tipo de negócio.

4. **Resumo vivo do briefing**
   - após cada resposta, atualizar uma síntese legível;
   - permitir correção rápida da síntese pelo utilizador.

5. **Sinalização de progresso**
   - indicar claramente etapa atual e próximos passos;
   - evitar sensação de formulário infinito.

6. **Mensagens de “falta pouco”**
   - quando dados mínimos estiverem próximos do suficiente;
   - orientar o utilizador para finalizar com confiança.

---

## Fluxo canónico (mínimo)

1. **Contexto da operação** (tipo de negócio / unidade operacional)
2. **Problema principal** (resultado que quer alcançar)
3. **Jornada crítica** (do início ao fim do caso mais importante)
4. **Domínios envolvidos** (CRM, Scheduling, Finance, Clinical, etc.)
5. **Restrições/regras** (compliance, disponibilidade, prioridades)
6. **Validação do resumo** (confirmação final do briefing sintetizado)

---

## Contrato mínimo de dados (entrevista guiada)

- `interview.sessionId`
- `interview.stepKey`
- `interview.stepQuestion`
- `interview.quickReplies[]`
- `interview.userAnswer`
- `interview.contextHelp`
- `interview.progress.current`
- `interview.progress.total`
- `briefing.summaryLive`
- `briefing.missingSignals[]`
- `briefing.readinessHint` (`insufficient`, `almost_ready`, `ready_for_planner`)

---

## Critérios de aceite (Definition of Done do slice)

O B.1 é considerado atendido quando:

- [x] o fluxo opera com uma pergunta por vez.
- [x] quick replies contextuais estão definidos por etapa.
- [x] cada pergunta possui ajuda contextual curta.
- [x] resumo vivo do briefing é atualizado ao longo do fluxo.
- [x] progresso e sinais de “falta pouco” estão previstos.
- [x] entrevista termina com validação explícita do resumo.

---

## Template canónico de etapa

```md
### Etapa <n> — <nome>

- Pergunta: <texto da pergunta>
- Quick replies: <opção 1>, <opção 2>, <opção 3>
- Ajuda contextual: <texto curto>
- Exemplo: <exemplo por negócio>
- Atualização do resumo vivo: <como consolidar a resposta>
- Critério para avançar: <condição mínima>
```

---

## Não-objetivos

- Não substitui o gate de suficiência (B.3).
- Não substitui o gate de adequação do plano (B.4).
- Não define ainda a inferência automática de tipo de negócio (B.2), apenas prepara a coleta.

---

## Próximo gap/loop recomendado

**Loop B.2 — Detectar tipo de negócio automaticamente** (usar respostas da entrevista para sugerir domínios/especialistas antes do planner final).
