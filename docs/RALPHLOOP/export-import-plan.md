
# Objetivo

Implementar, de forma incremental e segura, a correção do export/import de agentes e times no projeto `whitebeardit/agents-team-crafter`, garantindo que **toda a configuração runtime do agente seja preservada**.

Hoje foi identificado que, ao exportar/importar um time, algumas tools não aparecem/configuradas corretamente nos agentes especialistas. O JSON exportado mostrou casos como:

```json
"capabilities": {
  "tools": [],
  "customToolDefinitionIds": [...]
}
````

Porém algumas dessas tools pertencem ao catálogo built-in da própria plataforma, como:

* CRM
* Finance
* Scheduling
* Clinical
* Care
* Packages

Além disso, também precisamos garantir suporte explícito para built-in tools da OpenAI, como:

* `web_search`
* `file_search`
* `code_interpreter`

O objetivo final é que o export/import seja um **snapshot completo e confiável do agente**, incluindo:

* `systemInstruction`
* `systemRole`
* `openaiRuntimeModel`
* `capabilities`
* platform built-in tools
* OpenAI built-in tools
* custom tools
* `knowledge`
* `security`
* `channelConfig`
* MCP bindings
* qualquer campo runtime já existente ou futuro, sem perda silenciosa

---

# Regra obrigatória de execução

A implementação deve ser feita em etapas pequenas.

Ao final de **cada etapa**, execute:

```bash
npm test
npm run build
```

ou os comandos equivalentes do projeto, caso o backend/frontend tenham scripts separados.

Se houver monorepo com diretórios separados, rode os testes/builds relevantes para os arquivos alterados, por exemplo:

```bash
cd backend && npm test && npm run build
```

e, quando alterar frontend:

```bash
cd v0-team-ai-crafter && npm test && npm run build
```

Não avance para a próxima etapa enquanto build e testes não estiverem passando.

Não faça refactors grandes fora do escopo.

Não altere comportamento de negócio que não esteja diretamente relacionado ao export/import/configuração de agents/tools.

---

# Contexto técnico observado

Arquivos já identificados como relevantes:

* `backend/src/modules/agents/application/build-agent-export.ts`
* `backend/src/modules/teams/application/build-team-export.ts`
* `backend/src/modules/teams/application/import-team-from-export.ts`
* `backend/src/modules/agents/interfaces/agent.routes.ts`
* `backend/src/modules/agents/application/agent-config.schemas.ts`
* testes relacionados:

  * `backend/src/modules/agents/application/build-agent-export.test.ts`
  * `backend/src/modules/teams/application/build-team-export.test.ts`
  * `backend/src/modules/teams/application/parse-export-payload.test.ts`
  * `backend/src/modules/teams/application/import-team-from-export.reuse-channels.test.ts`

O export de agente hoje monta `sections.runtime` usando `agent['capabilities']`, `agent['knowledge']`, `agent['channelConfig']` e `agent['security']`.

O export de time chama `buildAgentExportPayload(...)` para cada agente.

O import de time recria os agentes a partir de `exp.agent`.

Precisamos formalizar e normalizar a estrutura runtime para evitar perda de configuração.

---

# Modelo desejado de capabilities

Implementar suporte explícito para separar os tipos de tools:

```ts
type AgentCapabilities = {
  /**
   * Legacy/backward compatibility.
   * Campo antigo usado pelo sistema.
   * Não remover agora.
   */
  tools: string[];

  /**
   * Built-in tools da plataforma Whitebeard/Agents Team Crafter.
   * Exemplo:
   * - crm.search_customer
   * - crm.create_customer
   * - packages.list_patient_packages
   * - scheduling.create_appointment
   * - clinical.register_attendance
   * - finance.create_charge
   * - care.create_record
   */
  platformBuiltInTools: string[];

  /**
   * Built-in tools da OpenAI.
   * Exemplo:
   * - web_search
   * - file_search
   * - code_interpreter
   */
  openaiBuiltInTools: string[];

  /**
   * Tools customizadas do workspace.
   * Essas podem continuar usando ObjectId.
   */
  customToolDefinitionIds: string[];
};
```

Importante:

* Built-in tools da plataforma devem ser exportadas por **chave estável**, não por ObjectId.
* Built-in tools da OpenAI devem ser exportadas por **chave estável**.
* ObjectId deve ficar apenas em `customToolDefinitionIds`.
* Manter compatibilidade com exports antigos que usam somente `capabilities.tools` e/ou `customToolDefinitionIds`.

---

# Etapa 1 — Criar normalizador de capabilities

Criar um módulo utilitário no backend, por exemplo:

```txt
backend/src/modules/agents/application/agent-capabilities.ts
```

Implementar:

```ts
export type TNormalizedAgentCapabilities = {
  tools: string[];
  platformBuiltInTools: string[];
  openaiBuiltInTools: string[];
  customToolDefinitionIds: string[];
};

export function normalizeAgentCapabilities(raw: unknown): TNormalizedAgentCapabilities;
```

Comportamento esperado:

1. Se `raw` for `null`, `undefined` ou inválido, retornar arrays vazios.
2. Se existir `tools`, preservar como array.
3. Se existir `platformBuiltInTools`, preservar como array.
4. Se existir `openaiBuiltInTools`, preservar como array.
5. Se existir `customToolDefinitionIds`, preservar como array.
6. Remover valores não string.
7. Remover duplicados.
8. Não lançar erro para payload legado.
9. Manter `tools` como campo legacy.
10. Não migrar automaticamente ObjectIds de `customToolDefinitionIds` para built-ins nesta etapa, a menos que já exista registry confiável para diferenciar built-in vs custom.

Exemplo:

```ts
normalizeAgentCapabilities({
  tools: ['legacy.tool', 'legacy.tool'],
  platformBuiltInTools: ['crm.search_customer'],
  openaiBuiltInTools: ['web_search'],
  customToolDefinitionIds: ['abc123', 123, null],
});
```

Resultado:

```ts
{
  tools: ['legacy.tool'],
  platformBuiltInTools: ['crm.search_customer'],
  openaiBuiltInTools: ['web_search'],
  customToolDefinitionIds: ['abc123'],
}
```

Adicionar testes unitários para:

* payload vazio;
* payload completo;
* payload com duplicados;
* payload com valores inválidos;
* payload legado só com `tools`;
* payload legado só com `customToolDefinitionIds`.

Após esta etapa, rodar build e testes.

---

# Etapa 2 — Atualizar schema de tools/capabilities

Localizar `toolsSchema` em:

```txt
backend/src/modules/agents/application/agent-config.schemas.ts
```

Atualizar o schema para aceitar explicitamente:

```ts
tools: string[];
platformBuiltInTools: string[];
openaiBuiltInTools: string[];
customToolDefinitionIds: string[];
```

Requisitos:

1. Todos os campos devem ser opcionais no input.
2. Aplicar default `[]` quando ausentes.
3. Manter compatibilidade com chamadas antigas que enviam apenas:

```json
{
  "tools": [],
  "customToolDefinitionIds": []
}
```

4. Não quebrar o endpoint `/agents/:id/tools`.

Atualizar o endpoint em:

```txt
backend/src/modules/agents/interfaces/agent.routes.ts
```

Hoje o endpoint monta algo como:

```ts
capabilities: {
  ...cap,
  tools: body.tools,
  customToolDefinitionIds: body.customToolDefinitionIds
}
```

Alterar para preservar e persistir todos os campos:

```ts
capabilities: normalizeAgentCapabilities({
  ...cap,
  ...body,
})
```

ou equivalente, desde que mantenha:

* `tools`
* `platformBuiltInTools`
* `openaiBuiltInTools`
* `customToolDefinitionIds`

A resposta do endpoint também deve devolver todos os campos normalizados.

Adicionar/ajustar testes existentes ou criar novos para validar update de tools com:

```json
{
  "platformBuiltInTools": ["crm.search_customer"],
  "openaiBuiltInTools": ["web_search"],
  "customToolDefinitionIds": ["custom-1"]
}
```

Após esta etapa, rodar build e testes.

---

# Etapa 3 — Criar snapshot runtime completo do agente

Atualizar:

```txt
backend/src/modules/agents/application/build-agent-export.ts
```

Criar função explícita:

```ts
export function buildAgentRuntimeSnapshot(
  agent: Record<string, unknown>,
  mcpBindings: unknown[],
) {
  ...
}
```

O snapshot runtime deve conter:

```ts
{
  openaiRuntimeModel,
  capabilities,
  knowledge,
  channelConfig,
  security,
  mcpBindings,
}
```

Comportamento:

* `capabilities` deve passar por `normalizeAgentCapabilities`.
* `knowledge` deve ser preservado de `agent['knowledge']`.
* `security` deve ser preservado de `agent['security']`.
* `channelConfig` deve ser preservado de `agent['channelConfig']`.
* `openaiRuntimeModel` deve ser preservado de `agent['openaiRuntimeModel']`.
* `mcpBindings` deve ser incluído no runtime snapshot, além de continuar no campo top-level `mcpBindings` para compatibilidade.

Alterar `buildAgentExportPayload` para:

1. Incluir `agent.capabilities` normalizado.
2. Incluir `agent.knowledge`, `agent.security`, `agent.channelConfig` como já acontece, mas sem perder no `sections.runtime`.
3. Preencher `sections.runtime` com o snapshot completo.
4. Manter `mcpBindings` top-level.

Formato esperado:

```ts
return {
  exportVersion: AGENT_EXPORT_VERSION,
  exportKind: 'agent',
  exportedAt: new Date().toISOString(),
  agent: {
    ...agent,
    capabilities: runtime.capabilities,
    knowledge: runtime.knowledge,
    security: runtime.security,
    channelConfig: runtime.channelConfig,
  },
  mcpBindings,
  sections: {
    mission: ...,
    system: {
      systemInstruction: agent['systemInstruction'],
      systemRole: agent['systemRole'],
      openaiRuntimeModel: runtime.openaiRuntimeModel,
    },
    domainProfile: agent['domain'],
    quality: ...,
    runtime,
  },
}
```

Adicionar testes em:

```txt
backend/src/modules/agents/application/build-agent-export.test.ts
```

Cenário obrigatório:

```ts
const agent = {
  id: 'agent-1',
  name: 'Especialista CRM',
  role: 'specialist',
  openaiRuntimeModel: 'gpt-5.4-mini',
  capabilities: {
    tools: ['legacy.tool'],
    platformBuiltInTools: ['crm.search_customer'],
    openaiBuiltInTools: ['web_search', 'file_search'],
    customToolDefinitionIds: ['custom-tool-1'],
  },
  knowledge: {
    sources: ['source-1'],
    useSessionMemory: true,
    usePersistentMemory: false,
  },
  security: {
    requiresApproval: true,
    accessLevel: 'write',
  },
  channelConfig: {
    telegram: { enabled: true },
  },
};
```

Validar que o export contém as mesmas informações em:

* `payload.agent.capabilities`
* `payload.sections.runtime.capabilities`
* `payload.sections.runtime.knowledge`
* `payload.sections.runtime.security`
* `payload.sections.runtime.channelConfig`
* `payload.sections.runtime.openaiRuntimeModel`
* `payload.sections.runtime.mcpBindings`

Após esta etapa, rodar build e testes.

---

# Etapa 4 — Atualizar import para extrair runtime completo

Atualizar:

```txt
backend/src/modules/teams/application/import-team-from-export.ts
```

Criar função auxiliar próxima ao import:

```ts
function extractAgentRuntimeFromExport(exp: TAgentExportPayload) {
  ...
}
```

Comportamento:

1. Ler primeiro de `exp.agent`.
2. Fazer fallback para `exp.sections.runtime`.
3. Fazer fallback para `exp.sections.system.openaiRuntimeModel`.
4. Normalizar capabilities com `normalizeAgentCapabilities`.

Exemplo:

```ts
function extractAgentRuntimeFromExport(exp: TAgentExportPayload) {
  const agent = exp.agent as Record<string, unknown>;
  const sections = exp.sections as Record<string, unknown> | undefined;
  const runtime = sections?.['runtime'] as Record<string, unknown> | undefined;
  const system = sections?.['system'] as Record<string, unknown> | undefined;

  return {
    capabilities: normalizeAgentCapabilities(
      agent['capabilities'] ?? runtime?.['capabilities'],
    ),
    knowledge: agent['knowledge'] ?? runtime?.['knowledge'],
    security: agent['security'] ?? runtime?.['security'],
    channelConfig: agent['channelConfig'] ?? runtime?.['channelConfig'],
    openaiRuntimeModel:
      agent['openaiRuntimeModel']
      ?? system?.['openaiRuntimeModel']
      ?? runtime?.['openaiRuntimeModel'],
  };
}
```

No loop de criação dos agentes, antes de `buildAgentCreateBody`, aplicar:

```ts
const runtime = extractAgentRuntimeFromExport(exp);

const body = buildAgentCreateBody(
  {
    ...a,
    capabilities: runtime.capabilities,
    knowledge: runtime.knowledge,
    security: runtime.security,
    channelConfig: runtime.channelConfig,
    openaiRuntimeModel: runtime.openaiRuntimeModel,
  },
  role,
);
```

Cuidado com a regra já existente de validação do modelo:

```ts
workspaceIntegrationsService.assertAgentRuntimeModelAllowed(...)
```

Preservar o comportamento atual:

* se o modelo não for permitido, remover e adicionar warning;
* se for permitido, preservar.

Adicionar teste de import com payload contendo runtime completo apenas em `sections.runtime`, para garantir fallback.

Adicionar teste de import com payload contendo runtime em `agent`, para garantir precedência.

Após esta etapa, rodar build e testes.

---

# Etapa 5 — Garantir export/import de time com runtime completo

Atualizar/validar:

```txt
backend/src/modules/teams/application/build-team-export.ts
```

Provavelmente não será necessária grande mudança, porque ele já usa:

```ts
buildAgentExportPayload(ag as Record<string, unknown>, mcp)
```

Mas adicionar teste em:

```txt
backend/src/modules/teams/application/build-team-export.test.ts
```

Cenário:

* time com coordenador;
* especialista CRM;
* especialista Scheduling;
* agente com:

  * `platformBuiltInTools`
  * `openaiBuiltInTools`
  * `customToolDefinitionIds`
  * `knowledge`
  * `security`
  * `channelConfig`
  * `openaiRuntimeModel`
  * `mcpBindings`

Validar que o JSON de export do time preserva tudo dentro de:

```ts
payload.agents[i].agent
payload.agents[i].sections.runtime
payload.agents[i].mcpBindings
```

Após esta etapa, rodar build e testes.

---

# Etapa 6 — Roundtrip test export/import

Criar ou ajustar teste integrado de roundtrip:

```txt
backend/src/modules/teams/application/import-team-from-export.*.test.ts
```

Objetivo:

1. Criar um payload de time com agentes completos.
2. Importar.
3. Buscar os agentes criados no repo mockado ou fake.
4. Verificar que a configuração foi preservada.

Cenário mínimo:

```ts
capabilities: {
  tools: ['legacy.tool'],
  platformBuiltInTools: [
    'crm.search_customer',
    'scheduling.create_appointment',
  ],
  openaiBuiltInTools: [
    'web_search',
    'file_search',
  ],
  customToolDefinitionIds: [
    'custom-tool-id-1',
  ],
}
```

Validar:

```ts
expect(importedAgent.capabilities.tools).toEqual(['legacy.tool']);

expect(importedAgent.capabilities.platformBuiltInTools).toEqual([
  'crm.search_customer',
  'scheduling.create_appointment',
]);

expect(importedAgent.capabilities.openaiBuiltInTools).toEqual([
  'web_search',
  'file_search',
]);

expect(importedAgent.capabilities.customToolDefinitionIds).toEqual([
  'custom-tool-id-1',
]);
```

Validar também:

```ts
expect(importedAgent.knowledge).toEqual(...)
expect(importedAgent.security).toEqual(...)
expect(importedAgent.channelConfig).toEqual(...)
expect(importedAgent.openaiRuntimeModel).toEqual(...)
```

Após esta etapa, rodar build e testes.

---

# Etapa 7 — Verificar UI de seleção/salvamento de tools

Localizar no frontend onde as tools do agente são exibidas/salvas.

Arquivos candidatos:

* `v0-team-ai-crafter/components/agents/agent-details-drawer.tsx`
* `v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx`
* `v0-team-ai-crafter/lib/api/client.ts`
* componentes relacionados a agent tools/capabilities

Objetivo:

Garantir que a UI envie para o backend uma estrutura separada:

```ts
{
  tools: legacyTools,
  platformBuiltInTools,
  openaiBuiltInTools,
  customToolDefinitionIds,
}
```

Regras:

1. Tools built-in da plataforma devem ir para `platformBuiltInTools`.
2. Tools built-in da OpenAI devem ir para `openaiBuiltInTools`.
3. Custom tools devem ir para `customToolDefinitionIds`.
4. Não colocar built-in platform tools em `customToolDefinitionIds`.
5. Não colocar OpenAI built-in tools em `customToolDefinitionIds`.

Se a UI ainda não tiver metadados suficientes para distinguir, adicionar/adaptar o tipo de tool exibido na UI:

```ts
type ToolCatalogItem = {
  id: string;
  key: string;
  name: string;
  origin: 'platform_builtin' | 'openai_builtin' | 'custom';
  category?: string;
}
```

Ao salvar:

```ts
const payload = {
  tools: selectedLegacyTools,
  platformBuiltInTools: selectedTools
    .filter((tool) => tool.origin === 'platform_builtin')
    .map((tool) => tool.key),
  openaiBuiltInTools: selectedTools
    .filter((tool) => tool.origin === 'openai_builtin')
    .map((tool) => tool.key),
  customToolDefinitionIds: selectedTools
    .filter((tool) => tool.origin === 'custom')
    .map((tool) => tool.id),
};
```

Após esta etapa, rodar build e testes do frontend/backend conforme necessário.

---

# Etapa 8 — Backward compatibility com exports antigos

Garantir que imports antigos continuem funcionando.

Casos antigos:

```json
"capabilities": {
  "tools": ["some.tool"],
  "customToolDefinitionIds": ["abc"]
}
```

Comportamento:

* `tools` deve ser preservado.
* `customToolDefinitionIds` deve ser preservado.
* `platformBuiltInTools` deve virar `[]`.
* `openaiBuiltInTools` deve virar `[]`.

Não tentar adivinhar automaticamente se um ObjectId antigo é built-in ou custom sem uma fonte confiável.

Se existir um registry interno que permita identificar que determinado ObjectId pertence a built-in platform tool, implementar uma etapa separada de migração. Caso contrário, deixar warning/documentação.

Adicionar teste em `parse-export-payload` ou import:

* payload antigo sem `platformBuiltInTools`;
* payload antigo sem `openaiBuiltInTools`;
* import deve passar.

Após esta etapa, rodar build e testes.

---

# Etapa 9 — Não vazar segredos

Revisar export para garantir que:

* secrets de canal continuam seguindo a lógica atual de `channelsFull.secretsEncrypted`;
* não exportar tokens OpenAI/API keys;
* não exportar segredos MCP em texto claro;
* não exportar credentials de custom tools se existirem no agent config.

Se encontrar dados sensíveis sendo exportados fora de `secretsEncrypted`, corrigir ou adicionar sanitização.

Não remover `secretsEncrypted` atual dos canais, porque o fluxo atual parece depender disso para reidratar canais.

Após esta etapa, rodar build e testes.

---

# Etapa 10 — Documentar o contrato

Criar ou atualizar documentação técnica, por exemplo:

```txt
docs/agent-export-import-runtime-contract.md
```

Conteúdo mínimo:

## Agent runtime export/import contract

Explicar:

* `platformBuiltInTools`
* `openaiBuiltInTools`
* `customToolDefinitionIds`
* `tools` como legacy
* `knowledge`
* `security`
* `channelConfig`
* `openaiRuntimeModel`
* `mcpBindings`

Explicar regra:

* platform built-ins são exportadas por chave estável;
* OpenAI built-ins são exportadas por chave estável;
* custom tools usam ID do workspace;
* import deve preservar tudo que estiver no runtime;
* exports antigos continuam aceitos.

Adicionar exemplo JSON:

```json
{
  "capabilities": {
    "tools": [],
    "platformBuiltInTools": [
      "crm.search_customer",
      "scheduling.create_appointment"
    ],
    "openaiBuiltInTools": [
      "web_search",
      "file_search"
    ],
    "customToolDefinitionIds": [
      "custom-tool-id-1"
    ]
  }
}
```

Após esta etapa, rodar build e testes.

---

# Critérios finais de aceite

A implementação só está concluída quando todos os critérios abaixo forem verdadeiros:

1. Export de agente preserva runtime completo.
2. Export de time preserva runtime completo de todos os agentes.
3. Import de time recria os agentes com:

   * prompt/system instruction;
   * modelo OpenAI;
   * capabilities;
   * platform built-in tools;
   * OpenAI built-in tools;
   * custom tools;
   * knowledge;
   * security;
   * channel config;
   * MCP bindings.
4. Built-in platform tools não são salvas em `customToolDefinitionIds`.
5. Built-in OpenAI tools não são salvas em `customToolDefinitionIds`.
6. Custom tools continuam em `customToolDefinitionIds`.
7. Exports antigos com `capabilities.tools` continuam importando.
8. Nenhum secret novo é exportado em texto claro.
9. Build passa.
10. Testes passam.
11. Foram adicionados testes cobrindo:

    * normalização de capabilities;
    * export de agente;
    * export de time;
    * import com runtime em `agent`;
    * import com runtime em `sections.runtime`;
    * compatibilidade com payload antigo.

---

# Observação importante sobre naming

Antes de criar nomes novos, verificar se o projeto já possui convenções para built-in tools.

Se já existir algo como:

```ts
origin: 'builtin'
```

ou:

```ts
type: 'builtin'
```

usar a convenção existente.

Se não existir, preferir nomes explícitos:

```ts
platformBuiltInTools
openaiBuiltInTools
customToolDefinitionIds
```

Evitar nomes ambíguos como apenas `tools` para novos casos.

Manter `tools` apenas por compatibilidade.

---

# Resultado esperado

Ao exportar novamente um time como `time-clinica-psicologica-v5`, os especialistas não devem sair assim:

```json
"capabilities": {
  "tools": [],
  "customToolDefinitionIds": [...]
}
```

Eles devem sair com runtime completo, por exemplo:

```json
"capabilities": {
  "tools": [],
  "platformBuiltInTools": [
    "crm.search_customer",
    "crm.create_customer",
    "crm.update_customer"
  ],
  "openaiBuiltInTools": [],
  "customToolDefinitionIds": []
}
```

E, se houver tools OpenAI habilitadas:

```json
"capabilities": {
  "tools": [],
  "platformBuiltInTools": [
    "scheduling.create_appointment"
  ],
  "openaiBuiltInTools": [
    "web_search",
    "file_search"
  ],
  "customToolDefinitionIds": []
}
```

O import deve restaurar exatamente essa configuração nos agentes especialistas e coordenadores.


