import { toolsSchema } from './agent-config.schemas.js';

describe('toolsSchema', () => {
  it('aceita lista de tools validas', () => {
    const parsed = toolsSchema.parse({
      tools: ['web_search'],
    });
    expect(parsed.tools).toEqual(['web_search']);
  });

  it('rejeita tool nao permitida', () => {
    expect(() =>
      toolsSchema.parse({
        tools: ['invalid_tool_xyz'],
      }),
    ).toThrow();
  });
});
