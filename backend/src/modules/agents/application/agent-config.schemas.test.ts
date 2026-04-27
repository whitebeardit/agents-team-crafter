import { agentDomainSchema, toolsSchema } from './agent-config.schemas.js';

describe('agentDomainSchema', () => {
  it('normaliza e limita exampleUserPhrases', () => {
    const d = agentDomainSchema.parse({
      exampleUserPhrases: ['  a  ', 'a', 'b'],
    });
    expect(d.exampleUserPhrases).toEqual(['a', 'b']);
  });
});

describe('toolsSchema', () => {
  it('aceita lista de tools validas', () => {
    const parsed = toolsSchema.parse({
      tools: ['web_search'],
    });
    expect(parsed.tools).toEqual(['web_search']);
  });

  it('aceita image_generation', () => {
    const parsed = toolsSchema.parse({
      tools: ['image_generation'],
    });
    expect(parsed.tools).toEqual(['image_generation']);
  });

  it('rejeita tool nao permitida', () => {
    expect(() =>
      toolsSchema.parse({
        tools: ['invalid_tool_xyz'],
      }),
    ).toThrow();
  });

  it('remove crm_access legado do catálogo (Loop 60)', () => {
    const parsed = toolsSchema.parse({
      tools: ['web_search', 'crm_access'],
    });
    expect(parsed.tools).toEqual(['web_search']);
  });

  it('remove database_query legado do catálogo (Loop 107)', () => {
    const parsed = toolsSchema.parse({
      tools: ['web_search', 'database_query'],
    });
    expect(parsed.tools).toEqual(['web_search']);
  });

  it('aceita customToolDefinitionIds opcionais', () => {
    const parsed = toolsSchema.parse({
      tools: ['web_search'],
      customToolDefinitionIds: ['507f1f77bcf86cd799439011'],
    });
    expect(parsed.customToolDefinitionIds).toHaveLength(1);
  });

  it('aplica defaults nos novos campos', () => {
    const parsed = toolsSchema.parse({});
    expect(parsed).toEqual({
      tools: [],
      platformBuiltInTools: [],
      openaiBuiltInTools: [],
      customToolDefinitionIds: [],
    });
  });
});
