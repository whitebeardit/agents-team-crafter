# Plano de evolução do `whitebeardit/agents-team-crafter`

> **Estado atual da implementacao:** a fonte de verdade do que ja foi entregue no Ralph Loop, etapas concluidas e proxima retomada e o ledger [`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`](./agents-team-crafter-plano-evolucao_IMPLEMENTADO.md). Este documento permanece como plano mestre e visao; secoes como «Proxima acao recomendada» no fim podem estar desatualizadas em relacao ao codigo — confira o IMPLEMENTADO antes de planejar trabalho novo.

## Objetivo

Evoluir o projeto atual para atender, de forma consistente, os objetivos do produto:

- **multi-tenant**
- **criação muito fácil e fluida de agentes e times**
- **wizard assistido por IA**
- **um coordenador sempre centralizando a comunicação com os canais**
- **especialistas sem sobreposição de função dentro do mesmo tenant/workspace**
- **controle do que está sendo executado**
- **visualização em tempo real**
- **UX simples, guiada e coerente com o runtime real**

---

# 1. Decisão executiva

## Decisão: **adotar a base atual e evoluir incrementalmente**

**Não recomendo reescrever o projeto do zero.**

A base atual já tem pilares muito bons e alinhados ao produto:

1. **multi-tenant por workspace**
2. **runtime com coordenador como agente principal**
3. **especialistas como tools do coordenador**
4. **Chat SDK já integrado**
5. **OpenAI Agents SDK já integrado**
6. **streaming SSE e live updates já existentes**
7. **wizard assistido por IA para criação de times já iniciado**
8. **editor de grafo já existente**
9. **BFF Fastify + MongoDB com separação modular razoável**

## O que isso significa na prática

A estratégia correta é:

- **preservar** o que já está certo
- **corrigir os desalinhamentos entre runtime e UX**
- **introduzir governança de domínio dos especialistas**
- **trocar criação “solta” de agentes por criação guiada**
- **persistir e estruturar melhor a execução em tempo real**
- **reduzir a liberdade da UI onde ela hoje induz erro conceitual**

---

# 2. O que deve ser mantido como está ou quase como está

## 2.1 Multi-tenancy baseada em `workspaceId`

A base atual está boa para continuar.

### O que já está correto

- isolamento por `workspaceId`
- middlewares tenant-aware
- repositórios que recebem workspace explicitamente
- teste de isolamento cross-tenant já existe
- segredos por workspace já cifrados

### Decisão

**Manter.**
Não mudar o conceito de `workspaceId`. Ele já funciona como o `tenantId` lógico do produto.

### Ajuste sugerido

Na camada de produto/documentação/UI, deixar explícito:

- **Tenant = organização**
- **Workspace = unidade lógica do tenant no sistema atual**

Ou, mais simples:

- manter **workspace** como nome interno e também nome do produto

---

## 2.2 Runtime com coordenador central e especialistas como tools

Essa é uma das melhores partes do projeto atual.

### O que já está correto

O runtime atual já segue a ideia certa:

- o **coordenador** é o único agente LLM de topo
- os **especialistas** são expostos como **tools**
- a comunicação externa passa pelo coordenador
- isso combina com o requisito de agregador central

### Decisão

**Manter e fortalecer.**

### O que não fazer

Não voltar para um modelo de handoff livre entre especialistas como mecânica principal do runtime.

### Diretriz definitiva de produto

Para este produto:

- **canais sempre entram no coordenador**
- **resposta externa sempre sai pelo coordenador**
- **especialistas não são porta de entrada/saída**
- **especialistas executam subtarefas**
- **coordenador agrega, decide, responde**

---

## 2.3 Chat SDK como camada de canais

A integração atual com Chat SDK é boa e deve ser preservada.

### O que já está correto

- webhooks públicos por canal
- resolução por workspace/canal
- segredos por canal
- integração com o runtime do time

### Decisão

**Manter.**

### Ajuste

Melhorar o contrato operacional e o painel de status por canal, mas sem trocar a base.

---

## 2.4 Team Live Broadcaster e SSE

Já existe uma base útil para live mode.

### O que já está correto

- `GET /teams/:id/live`
- `POST /teams/:id/run/stream`
- eventos de progresso
- deltas do coordenador
- integração com Redis opcional

### Decisão

**Manter e evoluir.**

### Problema atual

Hoje há transmissão ao vivo, mas ainda falta um modelo mais forte de:

- run persistida
- step persistido
- timeline histórica navegável
- replay consistente

---

## 2.5 Team Planner assistido por IA

O `team-plans` já é uma boa semente do produto.

### O que já está correto

- geração de plano com IA
- fallback se não houver OpenAI
- execução do plano com SSE
- criação do coordenador, especialistas, time e grafo

### Decisão

**Manter, mas expandir bastante.**

### Limitação atual

Ele gera novos agentes sem considerar adequadamente:

- agentes já existentes no workspace
- sobreposição de domínio no workspace
- recomendação de reutilização no mesmo workspace
- divisão de especialistas no workspace

---

# 3. Principais problemas atuais que impedem o produto de chegar no objetivo

## 3.1 Criação de agentes ainda é “CRUD”, não “produto guiado”

Hoje a criação de agente é simples demais para o objetivo do produto.

### Problema

O fluxo atual de criação de agente:

- pede nome
- descrição
- role
- categoria
- skills
- canais

Mas **não obriga** a definir claramente:

- domínio do especialista
- fronteira de responsabilidade
- input esperado
- output esperado
- critérios de qualidade
- conflitos com especialistas existentes

### Impacto

Isso permite:

- agentes duplicados
- agentes genéricos demais
- sobreposição de domínio
- catálogo desorganizado
- times difíceis de manter

---

## 3.2 Não existe guardião real de sobreposição de domínio

Esse é o maior gap funcional do projeto atual frente ao seu objetivo.

### Problema

Hoje não há validação séria de:

- sobreposição entre especialistas
- conflito entre responsabilidades
- duplicidade de domínio no workspace
- recomendação de reuso de agente existente

### Impacto

Viola diretamente um requisito central:

> não deve existir especialista com função sobreposta dentro do mesmo tenant/workspace.

### Decisão

Isso precisa virar **invariante de domínio**, não apenas aviso visual.

---

## 3.3 O grafo atual permite mais liberdade do que o runtime realmente usa

Hoje a UI dá a impressão de que o usuário está desenhando a lógica real de orquestração.

### Problema

O runtime real é centrado no coordenador com especialistas como tools.
Mas o editor:

- deixa o usuário conectar nós de forma mais livre
- exibe affordances de edição mais abertas do que o runtime suporta
- possui menu “Adicionar Nó”, mas sem fluxo completo de criação efetiva

### Impacto

Isso causa:

- confusão conceitual
- falsa sensação de que o grafo define o runtime
- UX menos fluida
- necessidade de validações defensivas no backend

### Decisão

A UI do grafo deve refletir o runtime real.
Para este produto, o grafo deve ser **hub-and-spoke**, simples e coerente.

---

## 3.4 Há live mode, mas ainda falta um modelo forte de execução persistida

O produto quer:

- saber o que está executando agora
- mostrar em tempo real
- consultar depois
- auditar
- replayar

### Problema

Hoje o streaming existe, mas o modelo de run ainda está fraco como domínio persistido.

### Impacto

Fica difícil entregar:

- histórico operacional forte
- inspeção de execução
- lista de runs
- painel de incidentes
- replay consistente
- comparação de runs

---

## 3.5 Existe duplicidade de UX entre wizard clássico e AI builder

Hoje existem dois caminhos principais:

- wizard clássico
- AI builder

### Problema

Isso fragmenta a experiência.

### Impacto

Para um produto cujo diferencial é “facilidade extrema”, o usuário não deveria ficar decidindo entre dois modelos de criação muito separados.

### Decisão

Unificar a experiência. Mas permitir o usuário editar o resultado do AI Builder.

---

## 3.6 Não existem “times de agentes da plataforma” como capability central do produto

Você quer algo muito importante:

- um **time da plataforma** que ajuda a criar times
- um **time da plataforma** que ajuda a criar agentes
- um **guardião de domínio** que impede overlap

### Problema

Hoje isso ainda não existe como capability de plataforma.  
O planner atual cria times, mas isso ainda não está modelado como um conjunto de agentes sistêmicos do produto. O time da plataforma pode ser criado, disponibilizado e editado quando o usuário cria pelo workspace da Whitebeard e entra com usuário admin da plataforma.

---

# 4. Direção arquitetural alvo

O produto deve evoluir para este comportamento:

## 4.1 Criação de agente

Sempre que alguém tentar criar um agente:

1. abre o **Wizard de Criação de Agente**
2. o pedido é enviado ao **Time Criador de Agentes da Plataforma**
3. esse time:
  - entende o objetivo do novo agente
  - propõe missão
  - define fronteira de domínio
  - sugere nome
  - sugere input/output
  - compara com agentes existentes do workspace
  - verifica overlap
4. o sistema decide:
  - **reutilizar existente**
  - **criar novo**
  - **dividir escopo**
  - **bloquear por sobreposição**

## 4.2 Criação de time

Sempre que alguém quiser criar um time:

1. começa por objetivo/problema
2. o **Time Criador de Times da Plataforma** propõe:
  - coordenador
  - especialistas
  - canais
  - checklist
3. o sistema cruza com agentes já existentes no workspace
4. reutiliza agentes quando possível
5. só cria novos especialistas quando realmente necessário
6. o grafo final é gerado de forma simples e coerente com o runtime

## 4.3 Execução

A execução deve ser modelada como:

- `Run`
- `RunStep`
- `RunEvent`
- `RunStream`

Com visualização:

- ao vivo
- histórica
- por time
- por canal
- por agente
- por workspace

---

# 5. Estratégia de entrega incremental

## Ordem prioritária

A ordem correta de implementação é:

1. **Governança de domínio dos agentes**
2. **Wizard de criação de agente**
3. **Unificação do wizard de criação de times**
4. **Persistência estruturada de runs**
5. **Alinhamento do grafo com o runtime real**
6. **Times/agentes sistêmicos da plataforma**
7. **Polimento de UX e rollout**

Essa ordem é importante porque cada fase alimenta a próxima.

---

# 6. Plano detalhado por etapas, módulos e entregáveis

---

# ETAPA 0 — Consolidar a base e alinhar contrato de produto

## Prioridade: altíssima

## Objetivo

Antes de expandir features, fechar os desalinhamentos mais perigosos entre UX, runtime e domínio.

## Módulos impactados

- `backend/src/modules/teams`
- `backend/src/modules/graphs`
- `backend/src/modules/team-runtime`
- `v0-team-ai-crafter/components/graph`
- `v0-team-ai-crafter/app/(app)/teams`
- documentação

## Mudanças

### 0.1 Tornar oficial o modelo de runtime

Formalizar no produto:

- coordenador = único agente de topo
- especialistas = tools
- canais = ligados ao coordenador
- grafo = representação operacional simplificada, não motor livre de orquestração

### 0.2 Remover affordances enganosas do editor de grafo

Hoje o editor sugere mais liberdade do que existe de fato.

#### Ajustes

- remover temporariamente o menu “Adicionar Nó” se ele não estiver completo
- bloquear criação manual arbitrária de arestas entre especialistas
- impedir UX que sugira runtime peer-to-peer
- permitir:
  - reposicionamento
  - inspeção
  - remoção de especialistas/canais do roster
  - talvez anotações visuais
- preservar coerência com hub-and-spoke

### 0.3 Definir explicitamente modos da UI

No editor de grafo:

- **modo estrutural**: mostra a topologia real do time
- **modo live**: mostra o que está acontecendo agora
- **modo edição avançada**: só no futuro, se houver necessidade real

## Entregáveis

- documento de contrato de runtime
- ajuste do editor de grafo para refletir runtime real
- remoção ou conclusão do “Adicionar Nó”
- regras de UI/UX do grafo alinhadas ao backend

## Critério de aceite

- nenhum usuário deve sair do editor acreditando que especialistas conversam livremente entre si
- o desenho do time deve refletir exatamente a ideia “canais → coordenador → especialistas”

---

# ETAPA 1 — Criar o módulo de Governança de Domínio dos Agentes

## Prioridade: máxima

## Objetivo

Impedir especialistas com função sobreposta no mesmo workspace.

## Módulos novos

- `backend/src/modules/agent-governance`
- `backend/src/modules/agent-domain`
- novas coleções MongoDB

## Módulos impactados

- `agents`
- `team-planning`
- `teams`
- `frontend /agents`
- `frontend /teams/ai-create`

## Mudanças de modelo

### 1.1 Evoluir o schema de agente

Adicionar ao agente campos explícitos de domínio:

```ts
domain: {
  summary: string
  keywords: string[]
  inputDescription: string
  outputDescription: string
  boundaries: string[]
  exclusions: string[]
}
```

Adicionar também:

- `qualityCriteria: string[]`
- `reuseHints?: string[]`
- `platformManaged?: boolean`
- `systemRole?: "team-crafter" | "agent-crafter" | "domain-guard" | null`

### 1.2 Criar `DomainGuardService`

Serviço determinístico no backend para comparar um draft de agente com os existentes no workspace.

#### Responsabilidades

- comparar `category`, `skills`, `responsibilities`, `domain.keywords`, `goal`
- calcular score de overlap
- classificar:
  - `safe`
  - `warning`
  - `conflict`
- sugerir:
  - usar agente existente
  - dividir escopo
  - ajustar boundary
  - converter novo agente em extensão de um existente

### 1.3 Criar `AgentOverlapReview`

Persistir avaliações de overlap para auditoria e explicabilidade.

#### Coleção MongoDB nova

- `agent_overlap_reviews`

Exemplo:

```json
{
  "workspaceId": "...",
  "draftAgent": {...},
  "matches": [
    {
      "agentId": "...",
      "score": 0.86,
      "classification": "conflict",
      "reason": "Sobreposição forte em validação fiscal e triagem de NF-e"
    }
  ],
  "decision": "block"
}
```

### 1.4 Regra de produto

Para especialista novo:

- se houver `conflict`, **bloquear por padrão**
- permitir override apenas para admin com justificativa
- para o fluxo normal do produto, recomendar:
  - reutilizar agente existente
  - dividir domínio

## Entregáveis

- novo schema de domínio do agente
- `DomainGuardService`
- repositório `agent_overlap_reviews`
- endpoint de avaliação de overlap
- bloqueio de criação com conflito

## Critério de aceite

- não é possível criar silenciosamente dois especialistas quase iguais no mesmo workspace
- o backend passa a proteger esse requisito, não só a UI

---

# ETAPA 2 — Transformar criação de agente em Wizard assistido

## Prioridade: máxima

## Objetivo

Substituir o CRUD simples de agentes por um fluxo guiado e inteligente.

## Módulos novos

- `backend/src/modules/agent-planning`
- `backend/src/modules/platform-agents`
- `frontend/app/(app)/agents/create`
- `frontend/components/agents/agent-creation-wizard`

## Módulos impactados

- `agents`
- `team-planning`
- `workspace store`
- `agents page`

## Mudanças

### 2.1 Criar o “Time Criador de Agentes da Plataforma”

Esse time será interno do produto.

#### Composição sugerida

- **Coordenador de desenho de agente**
- **Especialista de missão**
- **Especialista de naming**
- **Especialista de fronteira de domínio**
- **Especialista de overlap**

### 2.2 Novo fluxo de criação

O botão “Criar agente” deixa de abrir só um dialog simples.
Ele deve abrir um wizard com estas etapas:

1. **Objetivo do agente**
2. **Contexto do workspace/time**
3. **Resultado esperado**
4. **Sugestão automática pela IA**
5. **Validação de overlap**
6. **Decisão final**
  - reutilizar existente
  - criar novo
  - dividir especialista

### 2.3 Novo endpoint de planejamento de agente

Criar algo como:

- `POST /agent-plans`
- `PUT /agent-plans/:id`
- `POST /agent-plans/:id/execute`

### 2.4 Regra obrigatória

Toda criação de agente da UI passa por esse fluxo.

### 2.5 Quick create

Se quiser manter criação rápida:

- deixar só para plataforma/admin
- ainda assim chamar o `DomainGuardService` antes de persistir

## Entregáveis

- novo Agent Creation Wizard
- novo módulo `agent-planning`
- execução com criação efetiva do agente
- integração obrigatória com overlap guard

## Critério de aceite

- criar especialista fica simples para o usuário
- o sistema ajuda a definir escopo
- o sistema impede duplicação de papel

---

# ETAPA 3 — Unificar a experiência de criação de times

## Prioridade: alta

## Objetivo

Trocar a experiência fragmentada por uma única jornada fluida.

## Módulos impactados

- `v0-team-ai-crafter/components/teams/team-wizard.tsx`
- `v0-team-ai-crafter/app/(app)/teams/create/page.tsx`
- `v0-team-ai-crafter/app/(app)/teams/ai-create/page.tsx`
- `backend/src/modules/team-planning`

## Mudanças

### 3.1 Unificar wizard clássico e AI builder

Criar uma única experiência:

- entrada pelo objetivo/problema
- IA propõe
- usuário ajusta
- sistema valida
- execução cria o time

O fluxo manual pode existir como fallback dentro do mesmo wizard, não como produto separado.

### 3.2 Planner deve considerar agentes já existentes

Hoje o planner tende a criar novos agentes.
Ele deve passar a:

- ler catálogo do workspace
- sugerir reuso
- apontar duplicação
- criar só os que faltam

### 3.3 Planner deve respeitar a regra do coordenador

Sempre:

- 1 coordenador
- especialistas abaixo dele
- canais ligados ao coordenador
- nada de composição ambígua

### 3.4 Resultado do planner

O plano final deve poder marcar cada agente como:

- `existing`
- `new`
- `split_required`
- `conflict`

### 3.5 Execute plan deve ser inteligente

Na execução:

- reaproveitar IDs existentes
- criar apenas novos
- montar o time final
- montar o grafo coerente

## Entregáveis

- wizard unificado de times
- planner com reuso de agentes do workspace
- execute plan híbrido (reuso + criação)
- UX mais simples na entrada

## Critério de aceite

- o usuário não precisa decidir entre “wizard clássico” e “AI builder”
- criar time fica mais rápido e mais consistente

---

# ETAPA 4 — Estruturar a execução como domínio persistido

## Prioridade: alta

## Objetivo

Dar visibilidade real do que está executando e do histórico de execução.

## Módulos novos

- `backend/src/modules/runs`
- `backend/src/modules/run-events`
- `backend/src/modules/observability`

## Módulos impactados

- `team-runtime`
- `teams`
- `chat-sdk`
- `frontend team details`
- `frontend graph live`
- `frontend dashboard`

## Novas coleções MongoDB

- `runs`
- `run_steps`
- `run_events`

## Mudanças

### 4.1 Persistir `Run`

Campos:

- workspaceId
- teamId
- trigger
- channel
- status
- startedAt
- finishedAt
- coordinatorAgentId
- correlationId

### 4.2 Persistir `RunStep`

Campos:

- runId
- stepType
- agentId
- toolName
- status
- startedAt
- finishedAt
- summary

### 4.3 Persistir `RunEvent`

Campos:

- runId
- type
- payload
- createdAt

### 4.4 Adaptar broadcaster

O live broadcaster continua existindo, mas agora:

- transmite eventos
- e também persiste os eventos significativos

### 4.5 Criar endpoints novos

- `GET /runs`
- `GET /runs/:id`
- `GET /runs/:id/events`
- `GET /teams/:id/runs`

### 4.6 UI nova

Na ficha do time:

- aba de execução
- últimas runs
- run atual
- replay básico
- timeline por agente

## Entregáveis

- módulo de runs persistidas
- endpoints de consulta
- timeline histórica
- integração com live mode

## Critério de aceite

- é possível saber o que está rodando agora
- é possível revisar o que rodou ontem
- a execução deixa rastros duráveis

---

# ETAPA 5 — Corrigir e simplificar o editor de grafo para ficar muito fluido

## Prioridade: alta

## Objetivo

Fazer o grafo ser simples, útil e fiel ao produto.

## Módulos impactados

- `components/graph/graph-canvas.tsx`
- `teams/[id]/graph/page.tsx`
- backend graphs
- team graph validator

## Mudanças

### 5.1 O grafo deve ser roster-driven

O grafo deixa de ser um canvas livre e passa a ser:

- canais do time
- coordenador
- especialistas do time

### 5.2 Permitir edição que faça sentido

Permitir:

- reposicionar nós
- remover especialista do time
- remover canal do time
- abrir painel do nó
- ver live state
- destacar fluxo atual

Não permitir:

- desenho arbitrário de topologias irreais
- conexões sem efeito no runtime
- specialist-to-specialist como se fosse orquestração real

### 5.3 Melhorar live mode

No live mode:

- destacar coordenador em atividade
- destacar especialista ocupado
- mostrar step atual
- mostrar tool em uso
- mostrar mensagem do coordenador em streaming

### 5.4 Adicionar legendas operacionais

A UI deve deixar claro:

- verde = canal → coordenador
- azul = coordenador → especialista
- brilho = agente ativo
- ícone = erro ou espera

### 5.5 Tratar “Adicionar Nó”

Escolha recomendada:

- **não permitir adicionar nó solto no canvas**
- adicionar especialistas/canais por wizard ou side panel estrutural
- depois o canvas reflete

## Entregáveis

- editor mais simples
- live mode mais claro
- sem affordances falsas
- side panel estrutural para composição do time

## Critério de aceite

- o grafo ajuda, não confunde
- um usuário novo entende a estrutura do time em poucos segundos

---

# ETAPA 6 — Criar os agentes/times sistêmicos da plataforma

## Prioridade: média-alta

## Objetivo

Fazer a própria plataforma usar agentes para construir agentes e times.

## Módulos novos

- `backend/src/modules/platform-agents`
- `backend/src/modules/platform-teams`

## Mudanças

### 6.1 Criar agentes da plataforma

Sugestão mínima:

#### Time Criador de Agentes

- Coordenador de criação de agente
- Especialista em missão
- Especialista em naming
- Especialista em fronteira de domínio
- Especialista em overlap

#### Time Criador de Times

- Coordenador de composição de time
- Especialista em runtime
- Especialista em canais
- Especialista em grafo estrutural
- Especialista em reuso de agentes

### 6.2 Natureza desses agentes

Esses agentes não pertencem ao cliente como agentes editáveis comuns.
Eles são:

- `platformManaged: true`
- `origin: platform`
- visíveis indiretamente como capability do produto

### 6.3 Configuração

Esses times devem poder ser versionados pela plataforma.
Idealmente:

- configuração central
- prompts controlados
- telemetria própria

## Entregáveis

- catálogo de agentes sistêmicos
- times da plataforma operacionais
- integração com os wizards

## Critério de aceite

- criar agente/time passa a ser uma capability nativa do produto

---

# ETAPA 7 — Fortalecer governança, auditoria e rollout

## Prioridade: média

## Objetivo

Fechar a solução de forma enterprise-ready.

## Módulos impactados

- audit
- settings
- dashboard
- workspaces
- observability
- frontend admin

## Mudanças

### 7.1 Auditoria adicional

Registrar:

- tentativa de criar agente com overlap
- bloqueio por conflito
- override administrativo
- decisão de reutilizar agente existente
- criação de time com agentes novos e existentes

### 7.2 Dashboard operacional

Adicionar:

- times mais usados
- especialistas mais invocados
- conflitos de domínio pendentes
- agentes sugeridos para consolidação
- canais por time
- runs com erro

### 7.3 Migração dos dados existentes

Para agentes já criados:

- gerar fingerprint de domínio inicial
- rodar análise de overlap
- marcar warnings sem bloquear retroativamente
- expor backlog de consolidação

### 7.4 Feature flags

Liberar por etapa:

- overlap guard em warning mode
- depois blocking mode
- wizard novo por workspace
- depois default global

## Entregáveis

- auditoria ampliada
- dashboard de governança
- migração/backfill
- rollout controlado

## Critério de aceite

- a plataforma consegue evoluir sem quebrar tenants já ativos

---

# 7. Plano por módulo/serviço

---

## Módulo: `agents`

## Situação atual

Bom CRUD, mas submodelado para o objetivo do produto.

## Manter

- schema básico
- diferenciação coordinator/specialist
- restrição de canais nos especialistas

## Alterar

- enriquecer schema com domínio
- adicionar validação de overlap
- introduzir fluxo planejado de criação
- bloquear criação duplicada por domínio

## Entregas

1. schema enriquecido
2. serviços de governança
3. endpoints de plan/review
4. fluxo de criação guiada

---

## Módulo: `team-planning`

## Situação atual

Boa base, mas cria agentes sem consciência do workspace existente.

## Manter

- planner com IA
- fallback
- streaming
- estrutura draft → execute

## Alterar

- planner deve considerar agentes já existentes
- planner deve chamar overlap guard
- planner deve produzir plano híbrido (reuso + criação)
- planner deve deixar claro quais agentes são novos ou reutilizados

## Entregas

1. read-model do catálogo do workspace
2. recomendação de reuso
3. execute plan híbrido
4. integração com platform teams

---

## Módulo: `team-runtime`

## Situação atual

Muito bom e alinhado ao produto.

## Manter

- coordenador como top-level
- especialistas como tools
- progress callbacks
- external response pelo coordenador

## Alterar

- emitir/persistir run events
- enriquecer rastreabilidade
- adaptar para run persistence
- melhorar o contrato de eventos

## Entregas

1. persistência de run
2. persistência de steps
3. persistência de events
4. replay simples

---

## Módulo: `runtime`

## Situação atual

Boa fundação em cima do OpenAI Agents SDK.

## Manter

- `OpenAIAgentsRuntimeProvider`
- `runStep`
- `runCoordinatorTurn`
- tool composition

## Alterar

- adicionar metadados melhores de execução
- melhorar classificação de eventos
- padronizar payloads para observabilidade
- preparar extensibilidade para platform teams

## Entregas

1. normalização de eventos
2. IDs estáveis por step/tool
3. integração com persistência de runs

---

## Módulo: `graphs`

## Situação atual

Útil, mas permissivo demais para o runtime real.

## Manter

- estrutura básica
- validação de canais no coordenador
- enrichment e layout base

## Alterar

- tornar grafo mais restrito
- impedir desenho livre incoerente
- simplificar para hub-and-spoke
- orientar edição estrutural por roster

## Entregas

1. novo contrato do editor
2. validador alinhado ao runtime
3. UI simplificada

---

## Módulo: `chat-sdk`

## Situação atual

Bom e pronto para continuar.

## Manter

- rotas de webhook
- resolução de segredos por workspace/canal
- integração com runtime
- suporte multi-plataforma

## Alterar

- enriquecer eventos com `runId`
- melhorar observabilidade por canal
- expor health/status melhor na UI

## Entregas

1. status operacional por canal
2. correlação webhook → run
3. telemetria por canal

---

## Módulo: `frontend /agents`

## Situação atual

Catálogo bom, criação fraca para o objetivo do produto.

## Manter

- filtros
- listagem
- drawer
- add to team

## Alterar

- trocar dialog simples por wizard
- mostrar overlap warnings
- sugerir reuso
- mostrar fronteira de domínio do agente

## Entregas

1. Agent Creation Wizard
2. overlap review panel
3. badge de saúde de domínio
4. recomendação de reuso

---

## Módulo: `frontend /teams`

## Situação atual

Bom começo, mas experiência duplicada.

## Manter

- ficha do time
- tab de canais
- debug console
- live mode

## Alterar

- unificar wizard clássico com AI builder
- mostrar plano híbrido
- mostrar especialistas reutilizados
- melhorar feedback de execução

## Entregas

1. wizard unificado
2. review de plano com reuso
3. execução com timeline

---

## Módulo: `frontend /graph`

## Situação atual

Visualmente promissor, mas com affordances falsas.

## Manter

- React Flow
- live state
- side console
- remoção estrutural

## Alterar

- remover liberdade enganosa
- reforçar semântica coordenador/especialistas/canais
- integrar com runs persistidas
- corrigir o menu “Adicionar Nó”

## Entregas

1. graph simplificado
2. live mode melhor
3. timeline visual

---

# 8. Coleções MongoDB novas ou evoluídas

## Evoluir `agents`

Adicionar:

- `domain`
- `qualityCriteria`
- `platformManaged`
- `systemRole`

## Nova: `agent_overlap_reviews`

Para auditoria e decisão de overlap.

## Nova: `agent_plans`

Para drafts do wizard de criação de agentes.

## Evoluir `team_plans`

Adicionar suporte a:

- `existingAgentRefs`
- `proposedNewAgents`
- `conflicts`
- `reuseRecommendations`

## Nova: `runs`

Execução principal.

## Nova: `run_steps`

Passos da execução.

## Nova: `run_events`

Eventos detalhados.

## Nova: `platform_agent_teams`

Se quiser persistir configuração/versionamento dos times sistêmicos da plataforma.

---

# 9. Priorização real de backlog

## P1 — Entregar primeiro

Essas entregas desbloqueiam as próximas:

1. **ETAPA 0** — alinhar contrato runtime/UX
2. **ETAPA 1** — Domain Guard / overlap
3. **ETAPA 2** — Agent Creation Wizard

Sem isso, o produto continua permitindo erro conceitual no coração da modelagem.

## P2 — Na sequência

1. **ETAPA 3** — wizard unificado de times
2. **ETAPA 4** — runs persistidas
3. **ETAPA 5** — graph simplificado e live melhor

## P3 — Depois

1. **ETAPA 6** — platform teams
2. **ETAPA 7** — hardening e rollout

---

# 10. Proposta de releases incrementais

## Release 1 — Fundamentos de produto

### Escopo

- alinhar grafo ao runtime
- criar Domain Guard
- enriquecer schema de agente

### Resultado

O produto deixa de permitir especialistas duplicados sem controle.

---

## Release 2 — Criação de agente guiada

### Escopo

- Agent Creation Wizard
- agent plans
- overlap blocking
- recomendações de reuso

### Resultado

Criar especialistas fica fácil e seguro.

---

## Release 3 — Criação de times realmente fluida

### Escopo

- unificar wizard clássico e IA
- team plan híbrido
- reuso de agentes existentes

### Resultado

Criar times fica simples e consistente.

---

## Release 4 — Operação em tempo real + histórico

### Escopo

- runs
- run steps
- run events
- timeline histórica

### Resultado

Você passa a ter controle real do que executa agora e do que já executou.

---

## Release 5 — Plataforma inteligente de verdade

### Escopo

- platform agent teams
- dashboards de governança
- rollout e auditoria forte

### Resultado

A plataforma passa a usar agentes para construir agentes e times com governança.

---

# 11. Recomendação final

## Recomendação objetiva

**Aproveitar a base atual.**
Ela já está suficientemente boa nos pontos estruturais mais difíceis:

- multi-tenant
- coordinator-first runtime
- Chat SDK
- OpenAI Agents SDK
- SSE/live
- planner de times
- editor visual

## O que realmente precisa mudar

O problema do projeto hoje não é “arquitetura errada”.
O problema é:

- **governança de domínio dos especialistas ainda inexistente**
- **UX ainda mais aberta do que o runtime permite**
- **criação de agentes ainda pouco guiada**
- **execução ainda pouco persistida**
- **wizards ainda fragmentados**

## Em uma frase

A base atual é boa para ser o **core do produto**.
O que falta é transformá-la em uma **plataforma guiada, segura e fluida**, com:

- coordenador central
- especialistas bem delimitados
- criação guiada por times da plataforma
- overlap guard obrigatório
- visualização em tempo real + histórico
- UX realmente simples

---

# 12. Próxima ação recomendada

> **Estado atual:** a **retomada de trabalho** (o que fazer a seguir no código) está no ledger [`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`](./agents-team-crafter-plano-evolucao_IMPLEMENTADO.md): secções **«Próxima implementação recomendada»**, **«Checklist do próximo loop»** e tabela de status. O bloco abaixo é **contexto histórico** — era a «sprint inicial» quando este plano foi redigido; **grande parte já foi entregue** (governança e overlap, wizards, `runs`, grafo hub-and-spoke, governança operacional, tendências, SLO, Redis unificado, webhooks SLO, etc.). Não interprete a lista seguinte como backlog pendente linha a linha.

## Sprint inicial (contexto histórico da redação original)

Na ordem em que o plano original sugeria atacar o pacote:

### Backend

- criar `agent-governance`
- enriquecer schema de `agents`
- criar `agent_overlap_reviews`
- endpoint de review de overlap

### Frontend

- substituir “Criar agente” por um wizard inicial
- remover ou desativar affordances falsas do editor de grafo
- deixar o team graph 100% coerente com coordenador + especialistas + canais

### Produto

- oficializar o contrato:
  - canais -> coordenador
  - coordenador -> especialistas
  - sem especialistas sobrepostos

---

# 13. Resumo final de decisão

## Adotar

- multi-tenant atual
- runtime atual com coordinator + specialists as tools
- chat SDK atual
- SSE/live broadcaster atual
- planner atual como semente do wizard

## Alterar

- criação de agente
- validação de domínio
- planner para reuso
- persistência de execução
- editor de grafo
- UX unificada de criação

## Não fazer agora

- reescrita total
- runtime peer-to-peer entre especialistas
- grafo livre como fonte principal de orquestração

