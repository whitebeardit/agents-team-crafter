# Ralph Loop 87 — Especialistas operacionais: schemas reais, coleta de dados faltantes e contexto conversacional

## Contexto

A branch `main` já avançou bastante nas frentes de:

- team planner
- AI Builder
- bind per-agent
- built-ins mínimas
- preview estável
- execute proporcional ao risco
- workflow ownership explícito

Esses avanços continuam válidos.

Mas agora existe uma nova classe de falhas que impede o produto de parecer realmente funcional para o utilizador final:

1. **os especialistas de negócio ainda não estão confiáveis em runtime**
2. **há tools expostas ao modelo com schema incompatível com o modo estrito do OpenAI Agents SDK**
3. **as actions internas não carregam schema suficientemente rico para o modelo pedir os dados certos**
4. **o console/chat de teste é praticamente stateless**
5. **a experiência “listar clientes” e “cadastrar cliente” ainda não parece de produção**

Este loop não reabre a base arquitetural.
Este loop fecha a **operabilidade real dos especialistas**.

---

# Diagnóstico factual do código atual

## 1. `catalog_internal_actions` ainda pode quebrar por schema inválido no modo estrito
Em `backend/src/modules/runtime/application/build-specialist-sdk-tools.ts`, as tools de catálogo usam:

- `catalogArgs = z.object({ query: z.string().optional() ... })`

Isso afeta tools como:
- `catalog_internal_actions`
- `catalog_web_search`
- `catalog_file_search`
- `catalog_database_query`
- `catalog_calendar_access`

No modo estrito de function calling do OpenAI Agents SDK, esse shape com propriedade opcional costuma gerar schema inválido porque:
- `properties.query` existe
- mas `required` não contém `query`

O erro relatado pelo utilizador é compatível com isso:

> Invalid schema for function 'catalog_internal_actions'  
> 'required' é obrigatório e deve conter todas as chaves de 'properties'. A chave 'query' está ausente.

### Implicação
Mesmo antes do especialista “pensar certo”, a tool já falha no contrato.

---

## 2. `internal_actions` builtin está a competir com as `internal_action` reais do workspace
Hoje existe um builtin de catálogo chamado `internal_actions` em `build-specialist-sdk-tools.ts`.

Mas ele é apenas **stub**, com descrição:

- “Execute approved internal workspace actions (stub).”

Ao mesmo tempo, o runtime real de negócio usa:
- `WorkspaceToolDefinition.kind = internal_action`
- `customToolDefinitionIds`
- `BusinessToolRuntime`
- definitions `ws_*`

### Implicação
O modelo pode escolher:
- a tool errada (`catalog_internal_actions`)
em vez de:
- a tool certa (`ws_*` ligada ao `actionId` de negócio)

Para especialistas funcionarem de verdade, esta concorrência precisa ser resolvida.

---

## 3. As `internal_action` criadas automaticamente ainda nascem com `jsonSchema` genérico demais
Em `backend/src/modules/team-planning/application/ensure-planner-tool-definitions.ts`, as definitions são criadas com:

```ts
jsonSchema: {
  type: 'object',
  additionalProperties: true,
  description: `Parâmetros para a ação interna ${actionId}`,
}
```

Ou seja:
- sem `properties`
- sem `required`
- sem exemplos
- sem nomes de campos
- sem orientação de coleta

### Implicação
O modelo não sabe:
- quais campos são obrigatórios
- quais campos são opcionais
- como pedir as informações ao usuário
- como montar uma chamada válida

Isso explica o comportamento relatado no cadastro de cliente:
- ele só “parece entender” depois que o usuário fornece tudo
- ele não conduz uma coleta correta dos dados faltantes

---

## 4. O catálogo de business actions não expõe schema rico
Em `backend/src/modules/business-tools/application/business-tool-registry.ts`, o catálogo HTTP expõe hoje apenas:

- `actionId`
- `title`
- `description`
- `packId`

Não expõe:
- input schema
- required fields
- exemplos
- hints de coleta

### Implicação
A UI, o runtime e o planner não conseguem usar um contrato forte por action.

---

## 5. CRM atual ainda não cobre bem “listar clientes cadastrados” / “clientes ativos”
Em `backend/src/modules/crm/application/register-crm-pack.ts`:

- `crm_find_party` depende de `query`
- `crm_list_parties_by_role` depende de `role`
- `crm_create_party` exige `displayName`
- `PartyRepository.findByQuery(...)` devolve `[]` quando `query` está vazio
- `PartyRepository` hoje não modela `status` (`active` / `inactive`)

### Implicação
Pedidos naturais como:
- “liste os clientes cadastrados”
- “liste os clientes ativos”

ficam mal servidos porque:
- não existe uma action geral de listagem com filtros opcionais
- “ativo” nem sequer é um campo do CRM hoje
- o modelo pode cair na action errada ou inventar parâmetro obrigatório

---

## 6. O cadastro de cliente ainda não tem comportamento de coleta guiada
Hoje `crm_create_party` exige apenas `displayName` no backend.
Mas para uma experiência real de negócio, o agente deveria:

1. inferir que o utilizador quer cadastrar um cliente
2. saber quais campos mínimos são necessários
3. pedir **numa única pergunta** os dados que faltam
4. só chamar a tool quando tiver o mínimo necessário

Atualmente falta no sistema:
- schema forte por action
- prompt de slot filling
- erro estruturado de “campos faltantes”

---

## 7. O console/chat de teste não preserva contexto conversacional
No frontend, `TeamDebugConsole` envia cada mensagem via:

- `POST /teams/:id/run`
ou
- `POST /teams/:id/run/stream`

com payload:
- `message`
- `channel`
- etc.

No backend, `teamRunBodySchema` em `backend/src/modules/team-runtime/infra/registries/trigger-mapper-registry.ts` **não** aceita:
- `conversationId`
- `history`
- `sessionId`

E `ITeamInvocation` em `backend/src/modules/team-runtime/domain/team-invocation.ts` também não carrega transcript histórico.

### Implicação
Cada mensagem é tratada como invocação nova.
O “chat de teste” não é um chat de verdade.
É só uma sequência de runs isoladas.

---

# Objetivo do Loop 87

Fechar a lacuna entre:
- “o sistema já tem arquitetura”
e
- “os especialistas realmente funcionam numa conversa real”

## Resultado esperado
Ao final deste loop:

1. tools de catálogo deixam de quebrar por schema inválido
2. especialistas deixam de preferir a tool stub errada para ações de negócio
3. `internal_action` passa a ter schema real por action
4. o agente aprende a pedir os dados faltantes de forma guiada
5. listagem/cadastro de clientes passam a parecer funcionalidades reais
6. o chat de teste passa a manter contexto entre mensagens

---

# Escopo deste loop

## Incluído
- correção de schema de tools expostas ao modelo
- desambiguação entre builtin `internal_actions` e business actions reais
- contratos ricos por action de negócio
- **piloto vertical CRM** — melhoria específica do pack `crm` para listagem e cadastro (o mesmo critério de revisão aplica-se depois a finanças, care, etc. em loops dedicados)
- coleta guiada de campos faltantes
- contexto persistido no console/chat de teste
- atualização Ralph Loop oficial

## Fora do escopo
- redesign completo do AI Builder
- reabrir ETAPA 8
- billing
- 2FA
- self-service de workspace
- **cobertura completa** de todos os packs de negócio (finanças, care, scheduling, …) no mesmo slice — este loop entrega a **fundação transversal** mais o **piloto CRM**; as outras verticais entram em **Loops 88+** com o mesmo tipo de quebra por etapas
- redesign geral do CRM além do necessário para o fluxo de clientes no piloto

---

# Rollout por domínio (após a fundação)

O **Bloco D** deste documento aprofunda o **CRM** como primeira vertical completa. **Não** implica que finanças, care ou outros domínios estejam “fechados” quando o Loop 87 terminar.

| Camada | Conteúdo | Responsabilidade |
| --- | --- | --- |
| **Transversal (Loop 87)** | Blocos A, B, C, E, F + mecanismos partilhados (schemas, registry, slot-filling, debug) | Todos os packs beneficiam |
| **Vertical CRM (Loop 87, bloco D)** | Modelo Party, `crm_*`, listagem/cadastro de clientes | Piloto |
| **Vertical finanças / care / … (Loops 88+)** | Presets, actions, repositórios e testes por pack | Um slice Ralph coerente por domínio ou grupo de packs; mesma grelha de aceite que o CRM |

Detalhe de **candidatos a vertical**, critérios de priorização e regras de tamanho de slice: [§ Loops 88+ no plano mestre](agents-team-crafter-plano-evolucao.md#loops-88-mais-verticais-de-negócio-por-pack).

Ao planear o **Loop 88+**, copiar a estrutura: diagnóstico por sintoma → contratos → prompts → testes de conversa → gate.

---

# Implementação técnica detalhada

## Bloco A — corrigir schema das function tools

### A1. Tornar os schemas das catalog tools compatíveis com modo estrito
Arquivo:
- `backend/src/modules/runtime/application/build-specialist-sdk-tools.ts`

### Problema
Hoje:
```ts
const catalogArgs = z.object({
  query: z.string().optional()
})
```

### Mudança
Substituir por schema estrito compatível com function calling do OpenAI.

Uma abordagem segura:
- tornar `query` obrigatória
- instruir o modelo a usar `""` quando não houver filtro
- garantir que o JSON Schema final tenha `required: ["query"]`

Exemplo de intenção:
```ts
const catalogArgs = z.object({
  query: z.string().describe("Texto de consulta. Use string vazia quando não houver filtro específico.")
})
```

### Importante
Aplicar a mesma revisão aos fallbacks genéricos em:
- `backend/src/modules/runtime/application/build-workspace-custom-tools.ts`

Hoje `genericArgs` também usa `query` opcional.
Precisa ficar estritamente válido.

### Critério de saída
Nenhuma function tool exposta ao modelo deve falhar com erro de schema inválido por causa de propriedade opcional incompatível com o modo estrito.

---

## Bloco B — parar de oferecer `catalog_internal_actions` como caminho principal para especialistas de negócio

### B1. Rever a posição do builtin `internal_actions`
Arquivos:
- `backend/src/modules/runtime/application/build-specialist-sdk-tools.ts`
- `backend/src/modules/team-planning/application/planner-agent-catalog-tools.ts`
- `backend/src/modules/agents/domain/available-tools.ts`
- `v0-team-ai-crafter/lib/catalog-tool-ids.ts`
- docs relacionadas

### Problema
`internal_actions` é stub e compete com as `internal_action` reais do workspace.

### Decisão recomendada
Para especialistas de negócio, a capability real deve ser:
- `customToolDefinitionIds` → `ws_*` → `internal_action`

e não:
- `catalog_internal_actions`

### Mudança recomendada
1. **Não inferir nem sugerir** `internal_actions` como builtin para especialistas de packs de negócio.
2. Manter `internal_actions` apenas se houver uma razão operacional clara, e então documentá-la como capability separada.
3. Se a decisão for manter o builtin no catálogo técnico, evitar que o planner o distribua para times de negócio.

### Critério de saída
Quando o especialista precisar acionar CRM / Finance / Care / Clinical / Scheduling:
- ele deve usar as `internal_action` reais do workspace
- e não a builtin stub `catalog_internal_actions`

---

## Bloco C — schema real por business action

### C1. Enriquecer `business-action-presets.ts`
Arquivo:
- `backend/src/modules/business-tools/application/business-action-presets.ts`

### Mudança
Expandir `TBusinessActionPreset` para incluir algo como:

- `inputSchema`
- `examples`
- `requiredFieldLabels`
- `collectionHint`
- `defaultRoles`
- `slotFillingPromptHint`

Exemplo conceitual:
```ts
type TBusinessActionPreset = {
  title: string
  description: string
  packId?: string
  inputSchema?: Record<string, unknown>
  examples?: Array<Record<string, unknown>>
  requiredFieldLabels?: string[]
  slotFillingPromptHint?: string
}
```

### Objetivo
Cada action passa a carregar:
- o schema do input
- quais campos são obrigatórios
- exemplos reais
- como o agente deve pedir os dados faltantes

---

### C2. Expor schema no catálogo HTTP
Arquivos:
- `backend/src/modules/business-tools/application/business-tool-registry.ts`
- `backend/src/modules/business-tools/interfaces/business-actions.routes.ts`

### Mudança
`GET /business-actions/catalog` deve devolver também:
- `inputSchema`
- `requiredFieldLabels`
- `examples`

### Critério de saída
A UI, o runtime e futuras features de assistente conseguem consumir o contrato completo da action.

---

### C3. Criar `WorkspaceToolDefinition` com schema canônico da action
Arquivo:
- `backend/src/modules/team-planning/application/ensure-planner-tool-definitions.ts`

### Problema
Hoje a definition nasce com schema genérico.

### Mudança
Ao criar `internal_action`, usar o `inputSchema` do preset da action.

Se o preset tiver schema:
- gravar esse schema
- não usar mais o `{ type: "object", additionalProperties: true }` genérico

### Extensão importante
Adicionar uma rotina de **refresh/migração** para definitions já existentes com schema genérico, pelo menos quando:
- `kind = internal_action`
- `config.actionId` corresponde a preset com schema canônico
- a definition ainda está com schema genérico antigo

Isso pode ser feito por:
- rota/admin utilitária
- job de migração
- atualização oportunista no `ensureInternalActionDefinitions`

### Critério de saída
As `ws_*` tools de negócio passam a carregar schema real e útil para o modelo.

---

## Bloco D — CRM realmente utilizável para listar e cadastrar clientes

### D1. Evoluir o modelo do CRM
Arquivos:
- `backend/src/modules/crm/infra/party.model.ts`
- `backend/src/modules/crm/infra/party.repository.ts`
- `backend/src/modules/crm/application/register-crm-pack.ts`

### Problema
Hoje não existe `status` no CRM.
Mas o utilizador pede “clientes ativos”.

### Mudança recomendada
Adicionar `status` ao CRM:
- `active`
- `inactive`

Com:
- default `active` em criação
- retorno público com `status`
- suporte a update

### Critério de saída
“clientes ativos” passa a ter semântica real.

---

### D2. Introduzir uma action de listagem com filtros opcionais
Arquivo:
- `backend/src/modules/crm/application/register-crm-pack.ts`
- presets do business action

### Mudança recomendada
Adicionar action como:
- `crm_list_parties`

Com filtros opcionais:
- `query?: string`
- `roles?: string[]`
- `status?: "active" | "inactive"`
- `limit?: number`

### Regra operacional
- se `query` vier vazia, ainda assim a action deve listar
- o modelo não deve depender de `query` para algo simples como “liste clientes cadastrados”
- para “clientes ativos”, o modelo deve poder usar:
  - `roles: ["customer"]`
  - `status: "active"`

### Critério de saída
Pedir “liste os clientes cadastrados” ou “liste os clientes ativos” deixa de falhar por parâmetro ausente.

---

### D3. Melhorar semântica do cadastro de cliente
Arquivos:
- `register-crm-pack.ts`
- presets/schemas da action
- prompts do coordenador/especialista

### Regras recomendadas
Se o utilizador disser “cadastrar cliente”, o agente deve inferir:
- `roles` inclui pelo menos `customer`
- opcionalmente `payer` quando fizer sentido de negócio

O modelo não deve esperar o usuário saber o payload técnico.

### Critério de saída
A intenção “cadastrar cliente” vira um fluxo natural, não uma conversa sobre nome de campo.

---

## Bloco E — coleta guiada de dados faltantes (slot filling)

### E1. Prompt do coordenador e/ou especialistas
Arquivos:
- prompts do runtime/coordinator
- prompts específicos usados pelo team runtime
- eventualmente `team-plan-planner-prompt.ts` se houver reflexo nos templates

### Regra de produto a explicitar
Quando a intenção do utilizador corresponder a uma ação de escrita e faltarem campos obrigatórios, o agente deve:

1. **não** chamar a tool ainda
2. identificar os campos obrigatórios faltantes
3. fazer **uma única pergunta compacta**
4. pedir todos os dados faltantes de uma vez
5. depois disso, executar a action

### Exemplo esperado
Pedido:
> cadastre um cliente

Resposta esperada:
> Para cadastrar o cliente, preciso destes dados:
> - nome
> - e-mail
> - telefone
> - observações, se houver
> Me envie tudo de uma vez e eu prossigo.

### Critério de saída
O agente deixa de “esperar silenciosamente” payload pronto do utilizador.

---

### E2. Estruturar erro de campos faltantes no runtime
Arquivo:
- `backend/src/modules/business-tools/application/business-tool-runtime.ts`

### Problema
Hoje o runtime devolve basicamente:
- `EXECUTION_ERROR`
- `error: string`

### Mudança
Adicionar erro estruturado quando faltar input obrigatório, por exemplo:
- `errorCode: "MISSING_REQUIRED_FIELDS"`
- `result: { missingFields: ["displayName", ...] }`

Isso pode vir de:
- validação explícita no handler
- helper de validação por schema

### Critério de saída
Se o modelo ainda tentar executar cedo demais, o sistema devolve um erro rico o suficiente para a próxima resposta ser uma coleta guiada, não um “tente novamente”.

---

## Bloco F — contexto conversacional no chat de teste / Live SSE

### F1. Introduzir `conversationId` / `debugSessionId`
Arquivos:
- `backend/src/modules/team-runtime/infra/registries/trigger-mapper-registry.ts`
- `backend/src/modules/team-runtime/domain/team-invocation.ts`
- `backend/src/modules/teams/interfaces/team.routes.ts`
- `v0-team-ai-crafter/components/teams/team-debug-console.tsx`

### Mudança
Expandir o contrato do debug run para aceitar algo como:
- `conversationId?: string`

No frontend:
- manter um `conversationId` estável por sessão de console
- enviar o mesmo `conversationId` a cada turno
- permitir “Nova conversa”

### Critério de saída
A conversa de teste passa a ter identidade entre mensagens.

---

### F2. Persistir transcript de debug
Arquivos novos sugeridos:
- `backend/src/modules/team-runtime/infra/team-debug-session.model.ts`
- `backend/src/modules/team-runtime/infra/team-debug-session.repository.ts`

Ou estrutura equivalente já alinhada ao projeto.

### Conteúdo mínimo
Persistir por:
- `workspaceId`
- `teamId`
- `conversationId`
- `userId` ou actor
- turns:
  - role
  - content
  - timestamp

### Critério de saída
O backend consegue recuperar os turnos anteriores.

---

### F3. Reenviar histórico ao runtime
Arquivos:
- `team.routes.ts`
- `trigger-mapper-registry.ts`
- `team-invocation.ts`
- runtime/coordinator prompt

### Mudança
No `POST /teams/:id/run` e `/run/stream`:
- carregar histórico recente da `conversationId`
- anexar esse histórico à invocação

Opções aceitáveis:
1. adicionar `conversationHistory` a `ITeamInvocation`
2. sintetizar histórico no `coordinatorExternalContext`
3. usar um prompt de contexto do tipo “histórico recente da conversa”

### Recomendação
Preferir contrato explícito em `ITeamInvocation`, por exemplo:
```ts
conversation?: {
  id: string
  history: Array<{ role: "user" | "assistant"; content: string }>
}
```

### Critério de saída
A segunda mensagem do chat de teste já leva em conta a primeira.

---

### F4. UI do console
Arquivo:
- `v0-team-ai-crafter/components/teams/team-debug-console.tsx`

### Melhorias mínimas
- botão “Nova conversa”
- label da conversa atual
- manter `conversationId` por time em memória local
- opcionalmente mostrar “contexto ativo”

### Critério de saída
O utilizador entende quando está continuando uma conversa e quando abriu uma nova.

---

# Critérios de aceite

## Ferramentas / schemas
- nenhuma function tool falha por schema inválido no modo estrito
- `catalog_internal_actions` deixa de atrapalhar especialistas de negócio
- `internal_action` reais passam a ter schema canônico útil ao modelo

## CRM / especialistas
- “liste os clientes cadastrados” funciona sem exigir `query`
- “liste os clientes ativos” tem semântica real no CRM
- “cadastre um cliente” faz o agente pedir os dados faltantes de forma guiada
- o especialista não exige que o utilizador conheça payload técnico

## Contexto conversacional
- o chat de teste mantém contexto entre mensagens
- há noção de `conversationId`
- o utilizador pode reiniciar a conversa explicitamente

## UX
- especialistas parecem funcionais para tarefas reais
- menos erro técnico bruto visível ao utilizador
- menos sensação de que “cada mensagem é um contexto novo”

---

# Testes obrigatórios

## Backend
Adicionar ou expandir testes em:

- `backend/src/modules/runtime/application/build-specialist-sdk-tools.test.ts`
- `backend/src/modules/runtime/application/build-workspace-custom-tools.test.ts`
- `backend/src/modules/business-tools/application/business-tool-registry.test.ts`
- `backend/src/modules/crm/application/register-crm-pack.test.ts`
- `backend/src/__tests__/team-plans.integration.test.ts` se houver reflexo no planner
- testes de conversa debug / run se o slice introduzir sessão

### Cobrir
1. schemas de function tools válidos no modo estrito
2. `crm_list_parties` com `query` vazia
3. cadastro de cliente com schema canônico
4. migração/update de `internal_action` definitions genéricas
5. `conversationId` mantendo histórico entre chamadas

## Frontend
- `next build`
- smoke manual do `TeamDebugConsole`
- cenário:
  1. enviar mensagem 1
  2. enviar mensagem 2 dependente da primeira
  3. verificar continuidade do contexto
  4. clicar “Nova conversa”
  5. verificar isolamento da nova sessão

---

# Gate Ralph obrigatório

Executar:

```bash
./scripts/ralph-loop-gate.sh
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

Se houver smoke manual documentado para o console de debug/chat, executar também.

---

# Atualização documental obrigatória ao fechar

Ao encerrar o loop, atualizar:

1. `docs/RALPHLOOP/agents-team-crafter-plano-evolucao.md`
2. `docs/RALPHLOOP/agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`

## O que registrar
- novo Loop 87 como slice oficial
- que o foco passou de “base do AI Builder” para “especialistas realmente operacionais”
- decisão sobre `catalog_internal_actions`
- decisão sobre schema canônico por business action
- decisão sobre coleta guiada de campos faltantes
- decisão sobre `conversationId` / contexto do chat de teste

---

# Repriorização recomendada do roadmap

## Decisão
O próximo slice oficial deve priorizar **funcionamento real dos especialistas** antes de novas camadas cosméticas de UX.

### Justificativa
Hoje o problema mais grave não é:
- workflowKey inline
- copy de blocker
- refinamento visual

O problema mais grave é:
- especialistas ainda falham em tasks básicas
- tools internas ainda não têm schema rico
- chat de teste ainda não mantém contexto

## Recomendação
Transformar este slice em:

- **Loop 87 — Especialistas operacionais: schemas reais, coleta de dados faltantes e contexto conversacional**

E mover melhorias puramente cosméticas/UX do AI Builder para o loop seguinte.

---

# Ordem de implementação sugerida

1. corrigir schema estrito das function tools
2. parar de expor `internal_actions` stub como caminho principal
3. enriquecer presets com schema canônico
4. fazer `ensureInternalActionDefinitions` gravar schema real
5. evoluir CRM para listagem útil e status
6. implementar slot filling de campos faltantes
7. introduzir `conversationId` no debug console
8. persistir histórico
9. reusar histórico no runtime
10. testes
11. gate
12. atualizar docs Ralph Loop

---

# Resumo executivo do loop

Este loop fecha o que hoje mais machuca a credibilidade do produto:

- specialist tool quebrando por schema inválido
- CRM sem fluxo natural de listagem/cadastro
- agente sem coleta guiada de dados faltantes
- chat de teste sem memória entre mensagens

A meta é simples:

> fazer com que os especialistas realmente funcionem em tarefas reais de negócio, com tools válidas, inputs compreensíveis e contexto conversacional persistido.
