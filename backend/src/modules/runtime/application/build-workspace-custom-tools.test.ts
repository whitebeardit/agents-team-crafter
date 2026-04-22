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
      parameters: { type: string; properties: Record<string, unknown>; additionalProperties?: boolean };
      invoke: (runContext: unknown, input: string) => Promise<string>;
    }>;

    expect(crmTool.strict).toBe(false);
    expect(crmTool.parameters.type).toBe('object');
    expect(crmTool.parameters.properties).toBeDefined();
    expect(typeof crmTool.parameters.properties).toBe('object');
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

  it('crm_get_party_summary always exposes parameters.properties (OpenAI API rejects object without properties)', () => {
    const execute = jest.fn(async () => ({ ok: true, result: {} }));
    const [summaryTool] = buildWorkspaceCustomTools(
      [
        {
          id: 'tool-crm-summary',
          name: 'CRM summary',
          slug: 'ba-crm-get-party-summary',
          kind: 'internal_action',
          jsonSchema: { type: 'object', additionalProperties: true },
          config: { actionId: 'crm_get_party_summary' },
        },
      ],
      { workspaceId: 'workspace-1' },
      { businessToolRuntime: { execute } },
    ) as Array<{
      strict: boolean;
      parameters: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      };
    }>;

    expect(summaryTool.strict).toBe(false);
    expect(summaryTool.parameters.type).toBe('object');
    expect(summaryTool.parameters.properties).toBeDefined();
    expect(summaryTool.parameters.properties.partyId).toBeDefined();
    expect(Array.isArray(summaryTool.parameters.required) ? summaryTool.parameters.required : []).toContain(
      'partyId',
    );
    expect(summaryTool.parameters.additionalProperties).toBe(true);
  });

  it('internal_action with no preset and empty definition schema still gets properties object for API compatibility', () => {
    const execute = jest.fn(async () => ({ ok: true, result: {} }));
    const [t] = buildWorkspaceCustomTools(
      [
        {
          id: 'tool-unknown',
          name: 'Unknown action',
          slug: 'ba-unknown-test',
          kind: 'internal_action',
          jsonSchema: {},
          config: { actionId: 'definitely_missing_action_for_schema_probe_12345' },
        },
      ],
      { workspaceId: 'w1' },
      { businessToolRuntime: { execute } },
    ) as Array<{ parameters: { type: string; properties: Record<string, unknown> } }>;

    expect(t.parameters.type).toBe('object');
    expect(t.parameters.properties).toEqual({});
  });
});
