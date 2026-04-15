# Ralph Loop 130 — Produto GOLD agent-first: verticais perfeitas por agentes + assistente guiado de criação de times

## Contexto

As implementações mais recentes melhoraram bastante o produto em três frentes:

- **CRM GOLD** avançou com CRUD, `readiness`, `gold-gate`, filtros naturais e UI de auditoria com entrada orientada a especialistas
- **Scheduling GOLD** avançou com `gold-gate` e UI de auditoria com entrada orientada a especialistas
- várias verticais ganharam **`gold-gate`** no backend/runtime (`care`, `clinical`, `finance`, `services_sales`, `packages_encounters`, `reminders`, `github_ops`, `platform/admin`)

Além disso, o **AI Builder** já está forte em:

- revisão do plano
- bind preview
- overrides
- aprovação de bind
- clareza sobre reuso, packs e capabilities

Isso significa que o produto já deixou de ser apenas “packs no backend”.

Mas ainda existe uma lacuna central de produto:

> o utilizador ainda não é guiado o suficiente para criar **bons times**, e as verticais ainda não estão todas fechadas como **produto agent-first GOLD**.

---

## Diagnóstico factual do estado atual

### 1. O AI Builder ainda parte de um input demasiado livre

Hoje o fluxo principal de criação assistida de time ainda começa com:

- `Problema principal`
- `Contexto opcional`

Isso é poderoso para utilizadores experientes, mas frágil para o caso mais comum:

- o utilizador descreve mal o problema
- omite canal, domínio, objetivo de negócio, entidades, restrições ou fluxo real
- o planner gera um time incompleto
- especialistas relevantes ficam de fora
- as verticais e tools corretas não são usadas

### Conclusão

Ainda falta uma fase de:

- **entrevista guiada**
- **coleta incremental do briefing**
- **checagem de suficiência antes de gerar o plano**

---

### 2. O AI Builder já revisa bem o plano, mas ainda não guia suficientemente a entrada

A parte de **revisão e execução** do plano está muito mais madura do que a parte de **descoberta do problema**.

Em termos de produto:

- a parte de **planejar depois que o prompt chega** está forte
- a parte de **ajudar o utilizador a chegar num bom prompt/briefing** ainda está fraca

### Conclusão

O próximo salto não é mais no bind.

O próximo salto é:

- **briefing guiado antes do planner**
- **QA do plano gerado antes de salvar/executar**

---

### 3. O padrão agent-first ainda não está suficientemente padronizado entre as verticais

Hoje o padrão mais claro de produto agent-first aparece especialmente em:

- **CRM**
- **Agenda / Scheduling**

com UI do tipo:

- auditoria / health / gold-gate
- CTA para **operar via especialistas**

Esse é o caminho certo.

Mas ainda falta tornar isso padrão do produto para as outras verticais:

- Care
- Clinical
- Finance
- Services & Sales
- Packages & Encounters
- Reminders
- GitHub Ops
- Platform/Admin

### Conclusão

As verticais restantes ainda existem mais como:

- backend
- actions
- gates
- testes

…do que como **jornadas de produto agent-first fechadas**.

---

### 4. Ainda falta uma jornada de uso real dos times para operação de produto

Se o utilizador vai interagir com o sistema principalmente através dos agentes, então o produto precisa deixar claro:

- qual time usar para cada vertical
- qual coordenador é o dono daquela operação
- quais especialistas fazem parte do fluxo
- como iniciar a conversa operacional
- como validar que a vertical está pronta
- como perceber que o time está ruim e precisa ser regenerado ou corrigido

### Conclusão

Ainda falta um padrão explícito de:

- **time operacional por vertical**
- **entrada de conversa operacional**
- **starter prompts / sugestões**
- **gold-gate da vertical + readiness do time**

---

### 5. A UI precisa continuar simples, padrão e responsiva

O produto já evoluiu bem em responsividade e em AI Builder.

Mas, para a próxima fase, a régua precisa ficar mais clara:

- vertical page simples
- estado da vertical simples
- CTA principal simples
- conversa com o time simples
- troubleshooting só em camada avançada

### Regra de produto

A UI principal da vertical deve responder, sem esforço:

1. esta vertical está pronta?
2. qual time opera isto?
3. como começo a operar?
4. como vejo se deu certo?

---

## Decisão executiva do Loop 130

O próximo loop oficial deve fechar **a fundação agent-first GOLD do produto**.

### Este loop não é “mais uma vertical isolada”

Ele existe para preparar o sistema para que:

- todas as verticais possam ser fechadas com o mesmo padrão
- o utilizador chegue a um time bom mesmo quando não sabe descrever bem o problema
- o produto tenha uma jornada clara de operação via agentes

### Resultado esperado

Ao final do Loop 130, o produto deve ganhar:

1. **Assistente guiado de criação de time** antes do planner
2. **Briefing estruturado mínimo** para gerar times melhores
3. **Gate de suficiência do plano** antes do save/execute
4. **Padrão agent-first oficial de vertical**
5. **Sequência clara para fechar todas as verticais GOLD**

---

# O que significa agent-first GOLD

Uma vertical agent-first GOLD não é uma tela com CRUD manual como eixo principal.

A vertical agent-first GOLD é uma vertical onde:

- o utilizador entende a saúde da vertical
- o utilizador vê qual time a opera
- o utilizador entra pela conversa com o time
- o coordenador e especialistas executam o fluxo real
- a UI manual funciona como **auditoria / health / suporte / fallback controlado**, não como caminho principal

---

# Slices oficiais do Loop 130

## Loop 130.1 — Gap map oficial: produto atual vs produto agent-first GOLD

### Objetivo
Congelar o diagnóstico factual do estado atual do produto após as implementações recentes.

### Foco

Mapear explicitamente:

- o que já está pronto em CRM e Scheduling
- o que já existe em `gold-gate` nas outras verticais
- o que ainda não virou jornada agent-first
- o que falta no AI Builder de entrada guiada

### Entregáveis

- matriz `vertical atual` vs `vertical agent-first GOLD`
- matriz `AI Builder atual` vs `assistente guiado ideal`
- lista de gaps por camada:
  - descoberta do problema
  - geração do plano
  - adequação dos especialistas
  - entrada operacional do utilizador
  - UX/UI por vertical

### Critério de saída

Não implementar os próximos slices sem esta fotografia explícita.

---

## Loop 130.2 — Assistente guiado de criação de times (discovery interview)

### Objetivo
Parar de depender só de um campo livre de problema para gerar um bom time.

### Foco

Adicionar uma etapa de **entrevista guiada** antes do planner.

### Perguntas mínimas que o produto deve saber obter

- qual é o objetivo principal do time?
- qual vertical/domínio principal?
- qual resultado esperado de negócio?
- quais entidades o time vai operar?
- o time vai atender pessoas internas, clientes, pacientes, leads, agenda, finanças, documentos, tickets?
- qual canal principal?
- há restrição de integrações ou dados?
- há necessidade de CRUD, leitura, atendimento, automação, acompanhamento, operação administrativa?

### Regras de UX

- perguntas curtas
- uma de cada vez ou em pequenos blocos
- com linguagem simples
- mostrar progresso
- permitir “não sei” quando possível
- evitar parede de campos logo no início

### Critério de saída

O utilizador consegue chegar a um briefing útil sem precisar saber escrever um prompt bom.

---

## Loop 130.3 — Modelo de briefing estruturado para o planner

### Objetivo
Separar a coleta de informações da geração do plano.

### Foco

Criar um modelo estruturado intermediário, algo como:

- `problemSummary`
- `businessGoal`
- `primaryDomain`
- `secondaryDomains`
- `mainEntities`
- `primaryChannel`
- `operationKinds`
- `constraints`
- `mustHaveCapabilities`
- `mustAvoid`

### Regra

O planner deixa de depender só de:

- `problem`
- `context`

E passa a receber também um **briefing estruturado**.

### Critério de saída

O planner passa a gerar time com base em dados mais determinísticos e menos ambíguos.

---

## Loop 130.4 — Gate de suficiência do briefing antes do planner

### Objetivo
Evitar gerar time ruim quando ainda faltam dados críticos.

### Foco

Implementar uma checagem do tipo:

- briefing suficiente
- briefing parcialmente suficiente
- briefing insuficiente

### Regra

Se estiver insuficiente, o sistema deve:

- perguntar mais
- não gerar o plano ainda

### Exemplo

Se o utilizador disser só:

- “quero um time para ajudar no negócio”

isso não pode ir direto para o planner como se estivesse bom.

### Critério de saída

O sistema deixa de gerar plano pobre quando ainda não entendeu o problema.

---

## Loop 130.5 — Gate de adequação do plano gerado

### Objetivo
Detectar, antes de salvar/executar, quando o time gerado está incompleto para a vertical e o objetivo informados.

### Foco

Validar automaticamente coisas como:

- faltou coordenador adequado
- faltou especialista essencial da vertical
- faltou specialist owner do fluxo principal
- faltaram `catalogTools`/packs esperados
- faltou canal principal coerente
- ficou sobreposição de domínio mal resolvida

### Regra de produto

Se o plano estiver inadequado, o sistema deve:

- sugerir correção
- ou voltar para perguntas guiadas
- ou regenerar com diagnóstico explícito

### Critério de saída

Salvar/executar um time ruim passa a ser exceção, não regra.

---

## Loop 130.6 — Padrão oficial de vertical agent-first

### Objetivo
Definir um padrão único de como uma vertical de produto aparece para o utilizador.

### Estrutura da vertical page

Cada vertical deve ter, no mínimo:

1. **Resumo da vertical**
2. **Readiness / gold-gate**
3. **Time recomendado para operar a vertical**
4. **CTA principal: operar via especialistas**
5. **Prompts iniciais sugeridos**
6. **Fallbacks / auditoria / suporte**

### Regra

A UI manual detalhada deixa de ser o centro do produto.

O centro passa a ser:

- o time
- a conversa
- o fluxo operacional via agentes

### Critério de saída

Existe uma norma reaproveitável para qualquer vertical agent-first.

---

## Loop 130.7 — Entrada operacional do time por vertical

### Objetivo
Dar ao utilizador uma maneira simples e consistente de começar a operar uma vertical via time.

### Foco

Definir para cada vertical:

- qual time recomendado usar
- se o time já existe ou precisa ser criado
- como abrir a conversa operacional
- como reaproveitar starter prompts
- como trocar de time quando houver mais de um

### Resultado esperado

Algo como:

- “Operar via especialistas”
- “Abrir time operacional de CRM”
- “Usar time recomendado”
- “Criar time recomendado para esta vertical”

### Critério de saída

O utilizador não precisa navegar pela plataforma inteira para descobrir como usar a vertical.

---

## Loop 130.8 — Templates GOLD de times por vertical

### Objetivo
Transformar as verticais em algo rapidamente utilizável mesmo sem o AI Builder gerar tudo do zero.

### Foco

Criar **starter teams** e **templates operacionais** por vertical, com:

- coordenador correto
- especialistas mínimos corretos
- packs corretos
- tools corretas
- starter prompts
- validação
- gold-gate esperado

### Critério de saída

Cada vertical importante passa a ter pelo menos um template/time base de alta qualidade.

---

## Loop 130.9 — UX do AI Builder orientada a conversa guiada

### Objetivo
Fazer o AI Builder parecer mais assistente e menos formulário + preview técnico.

### Foco

Adicionar um fluxo progressivo como:

1. descoberta do problema
2. entendimento do domínio
3. confirmação do briefing
4. geração do plano
5. revisão do time
6. execução

### Regra

O preview técnico continua existindo, mas **depois** de o sistema ter entendido bem o problema.

### Critério de saída

O AI Builder passa a guiar, e não apenas reagir a um prompt livre.

---

## Loop 130.10 — UI padrão e responsiva para verticais agent-first

### Objetivo
Garantir consistência entre CRM, Scheduling e próximas verticais.

### Regras de UX/UI

- um cabeçalho simples por vertical
- cards de gate/readiness padronizados
- CTA principal padronizado
- prompts sugeridos padronizados
- troubleshooting em camada secundária
- responsividade forte em mobile/tablet/desktop

### Critério de saída

O produto parece um sistema único, não um conjunto de superfícies desconexas.

---

# Sequência oficial após o Loop 130

Depois da fundação agent-first GOLD, as verticais devem ser fechadas em sequência explícita.

## Loop 131 — CRM agent-first GOLD final

### Fechar

- jornada completa via time
- starter prompts operacionais
- team recomendado / fallback
- UX final da vertical
- teste E2E da jornada agent-first

---

## Loop 132 — Scheduling agent-first GOLD final

### Fechar

- jornada via time
- prompts de agenda
- confirmação / reagendamento / no-show / conclusão via agentes
- UX final da vertical

---

## Loop 133 — Finance agent-first GOLD

### Fechar

- health + gold-gate
- team financeiro recomendado
- prompts de operação financeira
- jornada via especialistas

---

## Loop 134 — Clinical agent-first GOLD

### Fechar

- história clínica via especialistas
- prompts clínicos seguros e claros
- team clínico recomendado
- UX final da vertical

---

## Loop 135 — Services & Sales + Packages agent-first GOLD

### Fechar

- catálogo / venda / pacote / atendimento via times
- prompts e time recomendado
- UX final

---

## Loop 136 — Care + Reminders agent-first GOLD

### Fechar

- sujeitos de cuidado
- lembretes
- uso via especialistas
- UX final

---

## Loop 137 — GitHub Ops + Platform/Admin agent-first GOLD

### Fechar

- times administrativos/operacionais
- prompts recomendados
- UX final destas verticais de suporte

---

# Critérios oficiais para considerar uma vertical perfeita

Uma vertical só pode ser marcada como perfeita quando entregar:

- **entrada simples para o utilizador**
- **time recomendado claro**
- **conversa operacional via agentes**
- **gold-gate / readiness confiável**
- **starter prompts úteis**
- **template/time base de qualidade**
- **fallback/auditoria claros**
- **UI padrão e responsiva**
- **testes do caminho principal**

---

# Resumo executivo final

O produto já melhorou muito em backend, gates e AI Builder.

O que ainda falta agora é o salto de produto mais importante:

> **tornar as verticais realmente utilizáveis via agentes, com uma UX muito fácil, e fazer o assistente de criação de times guiar melhor o utilizador desde o início.**

O Loop 130 existe para resolver exatamente isso.

Ele prepara o sistema para:

- gerar times melhores
- operar verticais pela conversa com agentes
- padronizar a UX agent-first
- fechar as verticais restantes com qualidade GOLD real
