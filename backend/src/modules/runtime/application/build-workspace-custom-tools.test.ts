import { describe, expect, it, jest } from '@jest/globals';
import { buildWorkspaceCustomTools } from './build-workspace-custom-tools.js';

describe('buildWorkspaceCustomTools', () => {
  it('falls back to preset schema for internal actions and preserves alias payload until runtime', async () => {
    const execute = jest.fn(async () => ({ ok: true, result: { id: 'party-1' } }));
    const runtime = { execute };
    const [crmTool] = buildWorkspaceCustomTools(
      [
        {
          id: 'tool-crm-create',
          name: 'CRM create',
          slug: 'ba-crm-create-party',
          kind: 'internal_action',
          jsonSchema: { type: 'string' },
          config: { actionId: 'crm_create_party' },
        },
      ],
      { workspaceId: 'workspace-1', correlationId: 'corr-1' },
      { businessToolRuntime: runtime },
    ) as Array<{
      strict: boolean;
      parameters: { type: string; additionalProperties?: boolean };
      invoke: (runContext: unknown, input: string) => Promise<string>;
    }>;

    expect(crmTool.strict).toBe(false);
    expect(crmTool.parameters.type).toBe('object');
    expect(crmTool.parameters.additionalProperties).toBe(true);

    const payload = {
      nome: 'Rita Davila',
      telefone: '+351900000000',
      mail: 'rita@gmail.com',
    };

    await crmTool.invoke(undefined, JSON.stringify(payload));

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        actionId: 'crm_create_party',
        correlationId: 'corr-1',
        input: expect.objectContaining(payload),
      }),
    );
  });
});
