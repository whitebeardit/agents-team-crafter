import { normalizeAgentCapabilities } from './agent-capabilities.js';

describe('normalizeAgentCapabilities', () => {
  it('retorna arrays vazios para payload vazio', () => {
    expect(normalizeAgentCapabilities(undefined)).toEqual({
      tools: [],
      platformBuiltInTools: [],
      openaiBuiltInTools: [],
      customToolDefinitionIds: [],
    });
  });

  it('preserva payload completo', () => {
    expect(
      normalizeAgentCapabilities({
        tools: ['legacy.tool'],
        platformBuiltInTools: ['crm.search_customer'],
        openaiBuiltInTools: ['web_search'],
        customToolDefinitionIds: ['custom-1'],
      }),
    ).toEqual({
      tools: ['legacy.tool'],
      platformBuiltInTools: ['crm.search_customer'],
      openaiBuiltInTools: ['web_search'],
      customToolDefinitionIds: ['custom-1'],
    });
  });

  it('remove duplicados', () => {
    expect(
      normalizeAgentCapabilities({
        tools: ['legacy.tool', 'legacy.tool'],
        platformBuiltInTools: ['crm.search_customer', 'crm.search_customer'],
        openaiBuiltInTools: ['web_search', 'web_search'],
        customToolDefinitionIds: ['custom-1', 'custom-1'],
      }),
    ).toEqual({
      tools: ['legacy.tool'],
      platformBuiltInTools: ['crm.search_customer'],
      openaiBuiltInTools: ['web_search'],
      customToolDefinitionIds: ['custom-1'],
    });
  });

  it('remove valores invalidos', () => {
    expect(
      normalizeAgentCapabilities({
        tools: ['legacy.tool', 1, null],
        platformBuiltInTools: ['crm.search_customer', false],
        openaiBuiltInTools: ['web_search', {}],
        customToolDefinitionIds: ['custom-1', 42],
      }),
    ).toEqual({
      tools: ['legacy.tool'],
      platformBuiltInTools: ['crm.search_customer'],
      openaiBuiltInTools: ['web_search'],
      customToolDefinitionIds: ['custom-1'],
    });
  });

  it('aceita payload legado apenas com tools', () => {
    expect(normalizeAgentCapabilities({ tools: ['legacy.tool'] })).toEqual({
      tools: ['legacy.tool'],
      platformBuiltInTools: [],
      openaiBuiltInTools: [],
      customToolDefinitionIds: [],
    });
  });

  it('aceita payload legado apenas com customToolDefinitionIds', () => {
    expect(normalizeAgentCapabilities({ customToolDefinitionIds: ['custom-1'] })).toEqual({
      tools: [],
      platformBuiltInTools: [],
      openaiBuiltInTools: [],
      customToolDefinitionIds: ['custom-1'],
    });
  });
});
