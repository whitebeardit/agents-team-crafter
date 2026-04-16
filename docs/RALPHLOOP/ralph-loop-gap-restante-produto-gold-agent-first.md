# Ralph Loop — GAP restante para produto GOLD agent-first

## Objetivo deste documento

Este documento descreve **o GAP restante** entre o estado atual do produto e o estado desejado de **produto GOLD agent-first**.

Ele foi escrito no estilo Ralph Loop, com:

- slices pequenos e incrementais
- critérios claros de saída
- foco em produto funcional real
- foco em UX muito fácil
- foco em operação via agentes
- foco em integridade entre domínios
- foco em UI padrão e responsiva

---

# 1. Estado atual resumido

## O que já está forte

### AI Builder / Team Planning
- entrevista guiada já existe
- briefing estruturado já existe
- gate de suficiência do briefing já existe
- gate de adequação do plano já existe
- modelo de integridade já começou a aparecer
- bind preview / governança / overrides amadureceram

### Runtime / execução
- execução do plano está mais segura
- bind e governança estão mais previsíveis
- conflitos importantes já são bloqueados
- CRM e Scheduling já deram passos importantes

---

## O que ainda não está GOLD

### Produto como um todo
- o produto ainda não está uniformemente **agent-first**
- ainda não está claro para o utilizador **qual time usar**
- ainda não está claro **qual especialista cuida de qual domínio**
- ainda não está uniforme em todas as verticais

### Verticais
- CRM e Scheduling estão mais adiantadas
- as outras verticais ainda não parecem fechadas com o mesmo nível de qualidade
- ainda falta experiência completa de produto, não apenas backend/runtime

### UX / UI
- o AI Builder melhorou bastante
- o restante do produto ainda precisa de uma linguagem única e simples
- a navegação e as páginas verticais ainda precisam reforçar o fluxo “operar via agentes”

### Operação por times
- já está claro que o melhor modelo é:
  - **um time por negócio/operação**
  - **especialistas por domínio**
- mas isso ainda precisa aparecer melhor no produto, no planner, nos templates e nas verticais

---

# 2. Meta GOLD final

Ao final deste plano, o produto deve permitir que um utilizador:

1. entenda rapidamente o estado do seu negócio/operação
2. saiba qual time o atende
3. saiba quais especialistas existem no time
4. consiga operar CRM, agenda, financeiro, etc. **pela conversa com o time**
5. veja as verticais como **portas de entrada/contexto**, não como ilhas isoladas
6. crie times bons mesmo sem saber escrever um prompt bom
7. tenha UX simples, padrão e responsiva
8. tenha jornadas principais testadas e confiáveis

---

# 3. Princípios oficiais

## 3.1 Modelo organizacional do produto

### Regra principal
> o time é do negócio; os especialistas são dos domínios.

### Regra operacional
- uma clínica, empresa ou operação deve ter **um time principal**
- esse time tem:
  - 1 coordenador
  - especialistas por domínio
- as páginas verticais devem abrir o **mesmo time da operação**, já focando no domínio certo

### Regra de integridade
- CRM, agenda, financeiro, care e clinical devem falar sobre as **mesmas entidades**
- não pode haver fragmentação silenciosa de sujeito, customer, patient, contact, encounter, cobrança etc.

---

## 3.2 Regra de UX

Toda experiência principal do produto deve responder rápido:

- onde eu opero isso?
- qual time faz isso?
- qual especialista cuida disso?
- como começo?
- como vejo se está saudável?
- o que fazer se algo estiver incompleto?

---

## 3.3 Regra de vertical

Uma vertical só pode ser considerada GOLD quando entregar:

- health / readiness / gold-gate
- time recomendado
- especialista claro
- prompts iniciais úteis
- operação via agentes
- fallback / auditoria
- UI consistente
- testes do caminho principal

---

# 4. GAP restante — visão macro

O GAP restante está concentrado em 6 frentes:

1. **descoberta e criação de times ainda podem melhorar**
2. **modelo de time por negócio ainda não está totalmente refletido no produto**
3. **verticais ainda não estão todas fechadas como entrada agent-first**
4. **UX padrão do produto ainda não está totalmente unificada**
5. **templates por tipo de negócio ainda faltam ou estão fracos**
6. **testes de produto / E2E / readiness ainda precisam fechar o ciclo GOLD**

---

# 5. Plano Ralph Loop — GAP restante

## Loop A — Fundar o produto agent-first de verdade

## Slice A.1 — Gap map oficial final

### Objetivo
Congelar uma fotografia objetiva do que já está pronto e do que ainda falta.

### Foco
Mapear, para cada vertical:

- existe backend?
- existe runtime?
- existe gate?
- existe página?
- existe CTA agent-first?
- existe team recomendado?
- existe especialista claro?
- existe starter prompt?
- existe fallback/auditoria?
- existe teste E2E?

### Entregáveis
- matriz por vertical
- score por vertical
- classificação:
  - `backend_only`
  - `partial_product`
  - `agent_first_ready`
  - `gold`

### Critério de saída
Nenhum loop seguinte começa sem esta matriz.

---

## Slice A.2 — Norma oficial de “vertical page”

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-a2-norma-oficial-vertical-page-agent-first.md`.

### Objetivo
Padronizar a estrutura de qualquer vertical do produto.

### Estrutura mínima obrigatória
Toda vertical page deve ter:

1. cabeçalho claro
2. resumo do domínio
3. health / readiness / gold-gate
4. time operacional recomendado
5. especialista do domínio em destaque
6. CTA principal: **operar via especialistas**
7. starter prompts
8. fallback / auditoria / troubleshooting

### Critério de saída
Existe um padrão oficial reutilizável para todas as verticais.

---

## Slice A.3 — Norma oficial de “operation team page”

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-a3-norma-oficial-operation-team-page.md`.

### Objetivo
Padronizar a visualização do time principal de uma operação/negócio.

### Estrutura mínima
A página do time deve mostrar:

- nome do time da operação
- objetivo do time
- coordenador
- especialistas por domínio
- entidades compartilhadas
- estado de readiness
- prompts principais
- atalhos por domínio
- histórico/execuções principais

### Critério de saída
Fica claro para o utilizador que o centro do produto é o **time da operação**.

---

## Slice A.4 — Modelo explícito de integridade multi-domínio

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-a4-modelo-integridade-multi-dominio.md`.

### Objetivo
Fechar o modelo de integridade entre os especialistas do mesmo time.

### Foco
Definir e implementar:

- entidade mestra de CRM
- entidade mestra clínica/care
- vínculo entre subject/contact/customer/patient
- vínculo entre agendamento e financeiro
- vínculo entre atendimento e financeiro
- regra de deduplicação
- regra de associação por chave natural

### Critério de saída
Existe documentação e implementação mínima para evitar fragmentação de entidades.

---

# 6. Loop B — AI Builder GOLD de verdade

## Slice B.1 — Melhorar a entrevista guiada

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-b1-melhorar-entrevista-guiada.md`.

### Objetivo
Deixar a fase de descoberta mais curta, mais humana e mais produtiva.

### Melhorias
- menos cara de formulário
- uma pergunta por vez
- quick replies mais inteligentes
- ajuda contextual
- exemplos por tipo de negócio
- reescrita do problema enquanto o utilizador responde

### Critério de saída
O utilizador sente que está numa conversa guiada, não num formulário técnico.

---

## Slice B.2 — Detectar tipo de negócio automaticamente

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-b2-detectar-tipo-negocio-automaticamente.md`.

### Objetivo
Reduzir atrito de criação de time.

### Foco
A partir das respostas, inferir:

- clínica
- consultoria
- operação comercial
- serviço recorrente
- operação administrativa
- outro

### Critério de saída
O sistema sugere domínios e especialistas antes do planner final.

---

## Slice B.3 — Gate de suficiência mais inteligente

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-b3-gate-suficiencia-mais-inteligente.md`.

### Objetivo
Evitar tanto subcoleta quanto burocracia excessiva.

### Foco
Passar de um gate simples para um gate com:

- campos mínimos por tipo de negócio
- campos mínimos por jornada
- mensagens de “falta pouco”
- sugestões de resposta

### Critério de saída
O sistema só bloqueia quando falta algo importante de verdade.

---

## Slice B.4 — Gate de adequação do plano com diagnóstico legível

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-b4-gate-adequacao-plano-diagnostico-legivel.md`.

### Objetivo
Quando o plano estiver ruim, o utilizador precisa entender por quê.

### Foco
Exibir claramente:

- faltou coordenador certo
- faltou especialista de domínio
- faltou integridade entre entidades
- faltou pack/tool relevante
- plano ficou fragmentado em excesso
- domínios não cobrem a jornada

### Critério de saída
O utilizador entende o problema do plano sem precisar interpretar backend.

---

## Slice B.5 — Regeneração orientada do plano

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-b5-regeneracao-orientada-plano.md`.

### Objetivo
Permitir corrigir o plano sem reiniciar do zero.

### Foco
Adicionar botões do tipo:

- adicionar especialista de CRM
- adicionar financeiro
- reforçar integridade entre domínios
- trocar foco para clínica
- simplificar time
- remover fragmentação por vertical

### Critério de saída
O utilizador consegue melhorar o plano com poucos cliques.

---

# 7. Loop C — Templates GOLD por tipo de negócio

## Slice C.1 — Definir catálogo de templates prioritários

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-c1-catalogo-templates-prioritarios.md`.

### Objetivo
Escolher os tipos de negócio prioritários.

### Lista inicial sugerida
- clínica psicológica
- clínica médica
- operação comercial com CRM + agenda + financeiro
- empresa de serviços
- consultoria
- operação administrativa interna

### Critério de saída
Existe uma lista oficial de templates prioritários.

---

## Slice C.2 — Template GOLD: clínica psicológica

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-c2-template-gold-clinica-psicologica.md`.

### Objetivo
Criar o primeiro template de referência.

### Estrutura mínima
- coordenador da clínica
- especialista de CRM
- especialista de agenda/atendimento
- especialista financeiro
- especialista clínico/care
- prompts iniciais
- entidades compartilhadas
- regras de integridade
- readiness esperado

### Critério de saída
A clínica psicológica vira template modelo do produto.

---

## Slice C.3 — Template GOLD: operação comercial

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-c3-template-gold-operacao-comercial.md`.

### Objetivo
Criar template para empresa orientada a vendas/atendimento.

### Estrutura mínima
- coordenador comercial
- especialista de CRM
- especialista de atendimento
- especialista financeiro
- especialista de follow-up

### Critério de saída
Existe template real para jornada de lead → atendimento → pagamento.

---

## Slice C.4 — Template GOLD: serviços/consultoria

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-c4-template-gold-servicos-consultoria.md`.

### Objetivo
Criar template para operação de prestação de serviço.

### Critério de saída
Existe template base para agendamento, entrega e faturamento.

---

# 8. Loop D — Verticais como portas de entrada agent-first

## Slice D.1 — CRM agent-first final

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-d1-crm-agent-first-final.md`.

### Objetivo
Fechar CRM como entrada perfeita para o time da operação.

### Deve ter
- health
- especialista de CRM em destaque
- time recomendado
- prompts de CRM
- abrir conversa focada em CRM
- fallback manual
- E2E da jornada principal

### Critério de saída
CRM fica claramente GOLD.

---

## Slice D.2 — Scheduling agent-first final

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-d2-scheduling-agent-first-final.md`.

### Objetivo
Fechar Agenda/Scheduling no mesmo nível.

### Deve ter
- health
- especialista de agenda
- prompts de agenda
- abrir conversa focada em Scheduling
- jornada reagendamento/no-show/confirmar

### Critério de saída
Agenda fica claramente GOLD.

---

## Slice D.3 — Finance vertical page

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-d3-finance-vertical-page.md`.

### Objetivo
Transformar Finance numa vertical visível e utilizável.

### Deve ter
- gate/readiness
- especialista financeiro
- prompts financeiros
- time recomendado
- auditoria/fallback

### Critério de saída
Finance deixa de ser só backend/runtime.

---

## Slice D.4 — Clinical vertical page

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-d4-clinical-vertical-page.md`.

### Objetivo
Dar superfície real para o domínio clínico.

### Deve ter
- especialista clínico
- prompts clínicos
- contexto de integridade com patient/contact
- fallback seguro
- gold-gate

### Critério de saída
Clinical vira parte real da UX.

---

## Slice D.5 — Care / Reminders / Services / Packages

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-d5-care-reminders-services-packages.md`.

### Objetivo
Fechar as verticais restantes no mesmo padrão.

### Estratégia
Implementar em grupos pequenos:
- Care + Reminders
- Services + Packages
- GitHub Ops + Platform/Admin

### Critério de saída
Todas as verticais relevantes possuem a mesma moldura agent-first.

---

# 9. Loop E — UX/UI padrão e responsiva

## Slice E.1 — Sistema visual único das verticais

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-e1-sistema-visual-unico-verticais.md`.

### Objetivo
Eliminar sensação de superfícies desconexas.

### Foco
Padronizar:
- cards de status
- cards de especialista
- CTA principal
- prompts sugeridos
- audit/troubleshooting
- layout mobile/tablet/desktop

### Critério de saída
Todas as verticais parecem pertencer ao mesmo produto.

---

## Slice E.2 — CTA principal único

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-e2-cta-principal-unico.md`.

### Objetivo
Ter um padrão claro de ação primária.

### Exemplo
Toda vertical deve ter um CTA do tipo:

- **Operar via especialistas**
- **Abrir time da operação**
- **Conversar com especialista deste domínio**

### Critério de saída
O utilizador nunca fica em dúvida sobre a ação principal.

---

## Slice E.3 — Responsividade real

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-e3-responsividade-real.md`.

### Objetivo
Garantir uso confortável em:
- desktop
- tablet
- mobile

### Critério de saída
As páginas principais do fluxo agent-first ficam utilizáveis em todos os tamanhos.

---

# 10. Loop F — Readiness, observabilidade e confiança de produto

## Slice F.1 — Readiness por vertical

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-f1-readiness-por-vertical.md`.

### Objetivo
Cada vertical precisa mostrar estado claro.

### Exemplos
- pronta
- parcialmente pronta
- faltando time
- faltando especialista
- faltando integridade
- faltando tool/pack
- faltando bind

### Critério de saída
O utilizador entende o que falta sem abrir backend.

---

## Slice F.2 — Readiness do time da operação

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-f2-readiness-time-operacao.md`.

### Objetivo
Avaliar se o time como um todo está pronto.

### Critério
- coordenador presente
- especialistas mínimos presentes
- domínios principais cobertos
- integridade mínima definida
- prompts principais disponíveis

### Critério de saída
Existe score/estado do time operacional.

---

## Slice F.3 — Troubleshooting simples

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-f3-troubleshooting-simples.md`.

### Objetivo
Dar suporte sem complicar a UX principal.

### Foco
Mostrar:
- por que a vertical não está pronta
- por que o time não está bom
- como corrigir
- links de ação

### Critério de saída
O troubleshooting vira camada secundária clara, não um labirinto.

---

## Slice F.4 — Observabilidade resumida da operação

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-f4-observabilidade-resumida-operacao.md`.

### Objetivo
Ter sinais claros, não ruído.

### Deve mostrar
- run success
- falhas críticas
- readiness de verticais/time
- top blockers
- risco/tendência

### Critério de saída
Gestor consegue avaliar saúde operacional em leitura curta.

---

# 11. Loop G — Testes e GOLD gate final

## Slice G.1 — Testes E2E do AI Builder

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-g1-testes-e2e-ai-builder.md`.

### Caminhos mínimos
- entrevista guiada
- briefing suficiente
- geração de plano
- adequação válida
- execução de plano

### Critério de saída
O fluxo principal do builder está protegido.

---

## Slice G.2 — Testes E2E das verticais principais

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-g2-testes-e2e-verticais-principais.md`.

### Mínimos
- CRM
- Scheduling
- Finance
- Clinical

### Critério de saída
As verticais principais têm regressão de produto.

---

## Slice G.3 — GOLD gate oficial por vertical

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-g3-gold-gate-oficial-por-vertical.md`.

### Objetivo
Definir quando uma vertical pode ser dada como pronta.

### Checklist final
- page pronta
- health/readiness
- especialista claro
- time recomendado
- prompts úteis
- operação via agentes
- fallback
- responsividade
- E2E principal

### Critério de saída
Existe uma definição objetiva de “vertical GOLD”.

---

# 11.1 Loop H — Sustentação pós-GOLD

## Slice H.1 — Revalidação periódica do GOLD gate

### Status
✅ Implementado — ver norma canónica em `docs/RALPHLOOP/ralph-loop-h1-revalidacao-periodica-gold-gate.md`.

### Objetivo
Garantir recertificação periódica das verticais GOLD para evitar regressão silenciosa.

### Critério de saída
Existe cadência e mecanismo formal de manutenção/revogação de status GOLD.

---

# 12. Ordem de execução recomendada

## Fase 1 — fundação
1. A.1 Gap map oficial final
2. A.2 Norma de vertical page
3. A.3 Norma de operation team page
4. A.4 Integridade multi-domínio

## Fase 2 — builder
5. B.1 Melhorar entrevista guiada
6. B.2 Detectar tipo de negócio
7. B.3 Gate de suficiência inteligente
8. B.4 Gate de adequação legível
9. B.5 Regeneração orientada

## Fase 3 — templates
10. C.1 Catálogo de templates prioritários
11. C.2 Template clínica psicológica
12. C.3 Template operação comercial
13. C.4 Template serviços/consultoria

## Fase 4 — verticais
14. D.1 CRM final
15. D.2 Scheduling final
16. D.3 Finance
17. D.4 Clinical
18. D.5 Restantes

## Fase 5 — UX e confiança
19. E.1 Sistema visual único
20. E.2 CTA principal único
21. E.3 Responsividade real
22. F.1 Readiness por vertical
23. F.2 Readiness do time
24. F.3 Troubleshooting simples
25. F.4 Observabilidade resumida

## Fase 6 — prova GOLD
26. G.1 E2E do builder
27. G.2 E2E das verticais
28. G.3 GOLD gate oficial

## Fase 7 — sustentação pós-GOLD
29. H.1 Revalidação periódica do GOLD gate

---

# 13. Definição de pronto final

O produto só deve ser chamado de **GOLD** quando:

- o utilizador consegue criar um bom time sem saber escrever bem o problema
- o modelo por negócio com especialistas por domínio está refletido no produto inteiro
- as verticais funcionam como portas de entrada agent-first
- a UX é simples e consistente
- a UI é responsiva
- as jornadas principais estão cobertas por testes
- CRM, Scheduling, Finance e Clinical estão fechados como produto real
- os templates principais já existem e são úteis

---

# 14. Resumo executivo final

O GAP restante já não é mais “criar backend” ou “adicionar mais runtime”.

O GAP restante agora é:

> **fechar o produto como experiência agent-first real, muito fácil de usar, organizada por negócio/operação com especialistas por domínio, e consolidar as verticais como portas de entrada GOLD para esse mesmo time operacional.**
