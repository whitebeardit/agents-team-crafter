# Agent runtime export/import contract

Este documento descreve o contrato de runtime usado no export/import de agentes e times.

## Campos de runtime

O snapshot de runtime exportado em `sections.runtime` inclui:

- `openaiRuntimeModel`
- `capabilities`
- `knowledge`
- `channelConfig`
- `security`
- `mcpBindings`

Esses mesmos dados também continuam no topo quando aplicável (`agent.*` e `mcpBindings`) para compatibilidade.

## Capabilities

`capabilities` segue o formato:

- `tools`: campo legado mantido por compatibilidade.
- `platformBuiltInTools`: built-ins da plataforma exportadas por chave estável.
- `openaiBuiltInTools`: built-ins da OpenAI exportadas por chave estável.
- `customToolDefinitionIds`: tools customizadas do workspace por ID.

Regras:

- built-ins da plataforma **não** devem ir em `customToolDefinitionIds`.
- built-ins da OpenAI **não** devem ir em `customToolDefinitionIds`.
- custom tools continuam em `customToolDefinitionIds`.
- imports legados sem `platformBuiltInTools`/`openaiBuiltInTools` continuam aceitos.

## Exemplo de capabilities

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

## Compatibilidade retroativa

No import:

1. primeiro lê runtime de `agent`;
2. faz fallback para `sections.runtime`;
3. para `openaiRuntimeModel`, também faz fallback para `sections.system.openaiRuntimeModel`.

`capabilities` sempre passa por normalização para garantir arrays válidos, sem duplicados e sem quebra em payload legado.
