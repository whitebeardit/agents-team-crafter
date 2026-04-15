# Ralph Loop 130 — Produto GOLD agent-first: operação por negócio com especialistas por domínio + assistente guiado de criação de times

## Contexto

As implementações mais recentes melhoraram bastante o produto em várias frentes:

- **CRM GOLD** avançou com CRUD, `readiness`, `gold-gate`, filtros naturais e UI de auditoria
- **Scheduling GOLD** avançou com `gold-gate` e UI orientada a operação
- várias verticais ganharam **`gold-gate`** no backend/runtime (`care`, `clinical`, `finance`, `services_sales`, `packages_encounters`, `reminders`, `github_ops`, `platform/admin`)
- o **AI Builder** já está forte em revisão do plano, bind preview, overrides, aprovação de bind e clareza sobre capabilities

Isso significa que o produto já deixou de ser apenas “packs no backend”.

Mas ainda existe uma lacuna central de produto:

> o utilizador ainda não é guiado o suficiente para criar **bons times**, e as verticais ainda não estão todas fechadas como **produto agent-first GOLD** com UX muito fácil.

---

## Decisão oficial de arquitetura de produto

### Modelo padrão

O modelo padrão do produto passa a ser:

- **um time operacional principal por empresa / unidade / operação**
- **um coordenador da operação**
- **especialistas por domínio/vertical dentro do mesmo time**

### Exemplo

Numa clínica de psicologia:

- 1 coordenador da clínica
- 1 especialista de CRM
- 1 especialista de atendimento/agendamento
- 1 especialista financeiro
- 1 especialista clínico/care
- opcionalmente 1 especialista de integridade operacional

Todos operam sobre a **mesma realidade de negócio**.

### Princípio oficial

> **o time é do negócio; os especialistas são das verticais/domínios.**

---

## Por que este modelo é melhor

### 1. Preserva contexto único da operação

O mesmo cliente/paciente pode atravessar:

- CRM
- agenda
- atendimento
- financeiro
- acompanhamento

Se cada vertical virar um time independente por defeito, o sistema corre risco de:

- fragmentar o contexto
- duplicar entidades
- piorar a integridade
- aumentar handoffs artificiais

### 2. Reflete a forma como o utilizador pensa

O utilizador normalmente não pensa:

- “agora vou falar com o time do CRM”
- “depois com o time do Financeiro”

Ele pensa:

- “quero operar minha clínica”
- “quero resolver a jornada do meu cliente/paciente”

### 3. Melhora a orquestração

Com um coordenador único da operação:

- a intenção do utilizador é entendida uma vez
- os especialistas certos são chamados
- a resposta final volta consolidada

---

## Papel das verticais

As verticais continuam existindo:

- CRM
- Scheduling
- Finance
- Clinical
- Care
- Services & Sales
- Packages & Encounters
- Reminders
- GitHub Ops
- Platform/Admin

Mas o papel delas muda.

### As verticais passam a significar

- **domínios de especialização**
- **superfícies do produto**
- **gates / readiness / auditoria / contexto operacional**
- **portas de entrada para o mesmo time do negócio**

### As verticais deixam de significar, por padrão

- um time completamente separado para cada uma

### Exceção

Times separados por vertical só devem ser padrão em cenários especiais:

- operações muito grandes
- tenants enterprise com alta escala por área
- equipas muito independentes
- exigência clara de isolamento operacional

---

## Diagnóstico factual do estado atual

### 1. O AI Builder ainda parte de um input demasiado livre

Hoje o fluxo principal de criação assistida de time ainda começa com:

- `Problema principal`
- `Contexto opcional`

Isso é poderoso para utilizadores experientes, mas frágil para o caso mais comum:

- o utilizador descreve mal o problema
- omite canal, domínio, objetivo de negócio, entidades ou restrições
- o planner gera um time incompleto
- especialistas relevantes ficam de fora
- as verticais e tools corretas não são usadas
- a integridade entre domínios não fica explícita

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
- a parte de **ajudar o utilizador a chegar num bom briefing** ainda está fraca

### Conclusão

O próximo salto é:

- **briefing guiado antes do planner**
- **QA do plano gerado antes de salvar/executar**

---

### 3. O padrão agent-first ainda não está suficientemente padronizado entre as verticais

Hoje o padrão mais claro de produto agent-first aparece especialmente em:

- **CRM**
- **Scheduling**

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

- qual time usar para aquela operação
- qual coordenador é o dono daquela operação
- quais especialistas fazem parte do fluxo
- como iniciar a conversa operacional
- como validar que a vertical está pronta
- como perceber que o time está ruim e precisa ser corrigido

### Conclusão

Ainda falta um padrão explícito de:

- **time operacional por negócio**
- **especialistas por domínio**
- **entrada de conversa operacional**
- **starter prompts**
- **readiness da vertical + readiness do time**
- **integridade entre entidades partilhadas**

---

### 5. A UI precisa continuar simples, padrão e responsiva

A UI principal da vertical deve responder, sem esforço:

1. esta vertical está pronta?
2. qual especialista deste domínio atua no meu time?
3. como começo a operar?
4. como vejo se deu certo?

---

## Objetivo do Loop 130

Fechar a fundação de **produto agent-first GOLD**, com dois eixos:

1. **verticais perfeitas operadas por times de agentes**
2. **assistente guiado de criação de times**

### Resultado esperado

Ao final do Loop 130, o produto deve ganhar:

1. **Assistente guiado de criação de time** antes do planner
2. **Briefing estruturado mínimo** para gerar times melhores
3. **Gate de suficiência do plano** antes do save/execute
4. **Gate de adequação do plano** antes de persistir/executar
5. **Padrão oficial de vertical agent-first**
6. **Modelo de operação por negócio com especialistas por domínio**
7. **Sequência clara para fechar todas as verticais GOLD**

---

# O que significa agent-first GOLD

Uma vertical agent-first GOLD é uma vertical onde:

- o utilizador entende a saúde da vertical
- o utilizador vê qual especialista daquele domínio atua no seu time
- o utilizador entra pela conversa com o time
- o coordenador e especialistas executam o fluxo real
- a UI manual funciona como **auditoria / health / suporte / fallback controlado**, não como caminho principal

---

# Slices oficiais do Loop 130

## Loop 130.1 — Gap map oficial: produto atual vs produto agent-first GOLD

### Objetivo
Congelar o diagnóstico factual do estado atual do produto.

### Foco

Mapear explicitamente:

- o que já está pronto em CRM e Scheduling
- o que já existe em `gold-gate` nas outras verticais
- o que ainda não virou jornada agent-first
- o que falta no AI Builder de entrada guiada
- o que falta no modelo de operação por negócio
- o que falta de integridade entre domínios

### Entregáveis

- matriz `vertical atual` vs `vertical agent-first GOLD`
- matriz `AI Builder atual` vs `assistente guiado ideal`
- matriz `modelo atual de times` vs `modelo negócio + especialistas`
- lista de gaps por camada:
  - descoberta do problema
  - geração do plano
  - adequação dos especialistas
  - entrada operacional do utilizador
  - UX/UI por vertical
  - integridade entre domínios

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
- qual é o tipo de negócio/operação?
- qual é a jornada principal a resolver?
- quais domínios precisam coexistir no mesmo time?
- quais entidades o time vai operar?
- existe cliente, paciente, lead, agenda, cobrança, atendimento, prontuário?
- qual canal principal?
- há restrição de integrações ou dados?
- há necessidade de CRUD, leitura, atendimento, automação, acompanhamento, operação administrativa?

### Regras de UX

- perguntas curtas
- uma de cada vez ou em pequenos blocos
- linguagem simples
- mostrar progresso
- permitir “não sei”
- evitar parede de campos no início

### Critério de saída

O utilizador consegue chegar a um briefing útil sem precisar saber escrever um prompt bom.

---

## Loop 130.3 — Modelo de briefing estruturado para o planner

### Objetivo
Separar a coleta de informações da geração do plano.

### Foco

Criar um modelo estruturado intermediário, com algo como:

- `problemSummary`
- `businessType`
- `operationalUnit`
- `businessGoal`
- `coreJourney`
- `primaryDomain`
- `secondaryDomains`
- `domainsNeeded`
- `mainEntities`
- `sharedEntities`
- `primaryChannel`
- `operationKinds`
- `constraints`
- `mustHaveCapabilities`
- `mustAvoid`
- `crossDomainIntegrityNeeds`

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

### Critério de saída

O sistema deixa de gerar plano pobre quando ainda não entendeu a operação.

---

## Loop 130.5 — Gate de adequação do plano gerado

### Objetivo
Detectar, antes de salvar/executar, quando o time gerado está incompleto para o negócio e para os domínios informados.

### Foco

Validar automaticamente coisas como:

- faltou coordenador adequado
- faltou especialista essencial da jornada principal
- faltou especialista de domínio necessário
- faltou modelagem de integridade entre domínios
- faltaram `catalogTools`/packs esperados
- faltou canal principal coerente
- ficou sobreposição de domínio mal resolvida
- o plano veio fragmentado demais em times separados sem necessidade

### Regra

Se o plano estiver inadequado, o sistema deve:

- sugerir correção
- ou voltar para perguntas guiadas
- ou regenerar com diagnóstico explícito

### Critério de saída

Salvar/executar um time ruim passa a ser exceção.

---

## Loop 130.6 — Padrão oficial de vertical agent-first

### Objetivo
Definir um padrão único de como uma vertical de produto aparece para o utilizador.

### Estrutura da vertical page

Cada vertical deve ter, no mínimo:

1. **Resumo da vertical**
2. **Readiness / gold-gate**
3. **Especialista daquele domínio**
4. **Time operacional recomendado**
5. **CTA principal: operar via especialistas**
6. **Prompts iniciais sugeridos**
7. **Fallbacks / auditoria / suporte**

### Regra

A vertical page é uma porta de entrada para o mesmo time da operação, não uma imposição de time isolado.

### Critério de saída

Existe uma norma reaproveitável para qualquer vertical agent-first.

---

## Loop 130.6A — Modelo de integridade entre especialistas do mesmo time

### Objetivo
Definir como os especialistas partilham entidades sem quebrar consistência.

### Foco

Definir explicitamente:

- entidade-mestra por domínio
- chaves naturais de ligação
- sincronização lógica entre especialistas
- regras para evitar duplicidade de cliente/paciente/lead/cadastro

### Exemplos

- o cliente do CRM deve ser o mesmo do atendimento
- o paciente clínico deve estar ligado ao contact principal
- a sessão concluída deve poder refletir no financeiro
- o follow-up deve manter o mesmo sujeito da jornada

### Critério de saída

O modelo de operação multi-domínio deixa de depender de “boa vontade” do time.

---

## Loop 130.7 — Entrada operacional do time por vertical

### Objetivo
Dar ao utilizador uma maneira simples e consistente de começar a operar um domínio via time.

### Foco

Definir para cada vertical:

- qual time recomendado usar
- se o time já existe ou precisa ser criado
- como abrir a conversa operacional
- como focar no especialista daquele domínio
- como reaproveitar starter prompts
- como trocar de time quando houver mais de um

### Regra

A entrada por vertical não deve presumir um time diferente.
Ela deve permitir abrir o **mesmo time da operação**, já com foco no domínio.

### Critério de saída

O utilizador não precisa descobrir sozinho como usar a vertical.

---

## Loop 130.8 — Templates GOLD de times por negócio/operação

### Objetivo
Transformar o produto em algo rapidamente utilizável mesmo sem o AI Builder gerar tudo do zero.

### Foco

Criar **starter teams** e **templates operacionais** por tipo de negócio, com:

- coordenador correto
- especialistas mínimos corretos
- packs corretos
- tools corretas
- starter prompts
- validação
- gold-gate esperado

### Exemplos

- clínica psicológica
- clínica médica
- empresa de serviços
- consultoria
- operação comercial com CRM + agenda + financeiro

### Critério de saída

Cada tipo de negócio importante passa a ter pelo menos um template base de alta qualidade.

---

## Loop 130.9 — UX do AI Builder orientada a conversa guiada

### Objetivo
Fazer o AI Builder parecer mais assistente e menos formulário + preview técnico.

### Foco

Adicionar um fluxo progressivo como:

1. descoberta do problema
2. entendimento do negócio
3. entendimento dos domínios necessários
4. confirmação do briefing
5. geração do plano
6. revisão do time
7. execução

### Critério de saída

O AI Builder passa a guiar, e não apenas reagir a um prompt livre.

---

## Loop 130.10 — UI padrão e responsiva para verticais agent-first

### Objetivo
Garantir consistência entre CRM, Scheduling e próximas verticais.

### Regras de UX/UI

- cabeçalho simples por vertical
- cards de gate/readiness padronizados
- CTA principal padronizado
- prompts sugeridos padronizados
- troubleshooting em camada secundária
- responsividade forte em mobile/tablet/desktop

### Critério de saída

O produto parece um sistema único.

---

# Sequência oficial após o Loop 130

Depois da fundação agent-first GOLD, os próximos loops fecham os domínios como capacidades GOLD dentro do modelo de **time por negócio com especialistas por domínio**.

## Loop 131 — CRM agent-first GOLD final
- jornada completa via time
- starter prompts operacionais
- especialista de CRM claro
- UX final da vertical
- E2E da jornada agent-first

## Loop 132 — Scheduling agent-first GOLD final
- jornada via time
- prompts de agenda
- confirmação / reagendamento / no-show / conclusão via agentes
- UX final da vertical

## Loop 133 — Finance agent-first GOLD
- health + gold-gate
- especialista financeiro claro
- prompts de operação financeira
- jornada via especialistas

## Loop 134 — Clinical agent-first GOLD
- história clínica via especialistas
- prompts clínicos claros
- especialista clínico claro
- UX final da vertical

## Loop 135 — Services & Sales + Packages agent-first GOLD
- catálogo / venda / pacote / atendimento via times
- prompts e especialista adequado
- UX final

## Loop 136 — Care + Reminders agent-first GOLD
- sujeitos de cuidado
- lembretes
- uso via especialistas
- UX final

## Loop 137 — GitHub Ops + Platform/Admin agent-first GOLD
- times administrativos/operacionais
- prompts recomendados
- UX final destas verticais de suporte

---

# Critérios oficiais para considerar uma vertical perfeita

Uma vertical só pode ser marcada como perfeita quando entregar:

- **entrada simples para o utilizador**
- **especialista daquele domínio claro**
- **time recomendado claro**
- **conversa operacional via agentes**
- **gold-gate / readiness confiável**
- **starter prompts úteis**
- **template/time base de qualidade**
- **integridade com os outros domínios**
- **fallback/auditoria claros**
- **UI padrão e responsiva**
- **testes do caminho principal**

---

# Resumo executivo final

O produto já melhorou muito em backend, gates e AI Builder.

O que ainda falta agora é o salto de produto mais importante:

> **tornar as verticais realmente utilizáveis via agentes, com uma UX muito fácil, dentro de um modelo de time por negócio/operação com especialistas por domínio, e fazer o assistente de criação de times guiar melhor o utilizador desde o início.**
