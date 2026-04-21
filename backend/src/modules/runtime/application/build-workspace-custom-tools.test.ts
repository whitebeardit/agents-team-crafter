import { describe, expect, it, jest } from '@jest/globals';
import { buildWorkspaceCustomTools } from './build-workspace-custom-tools.js';
import type { IWorkspaceCustomToolDefinition } from '../ports/agent-runtime.provider.js';
import { hydrateCrmCreatePartyInputFromConversation } from '../../crm/application/crm-conversation-context.js';

describe('buildWorkspaceCustomTools', () => {
  it('includes internal_action tool definitions for CRM actions', async () => {
    const defs: IWorkspaceCustomToolDefinition[] = [
      {
        id: 'tool-1',
        name: 'Negocio: crm_create_party',
        slug: 'ba-crm-create-party',
        kind: 'internal_action',
        jsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        config: { actionId: 'crm_create_party' },
      },
    ];
    const tools = buildWorkspaceCustomTools(defs, { workspaceId: 'ws-1' }, {
      businessToolRuntime: { execute: jest.fn(async () => ({ ok: true })) },
    });
    expect(tools).toHaveLength(1);
  });
});

describe('hydrateCrmCreatePartyInputFromConversation', () => {
  it('prevents empty submittedInput when the conversation already contains the customer data', () => {
    const hydrated = hydrateCrmCreatePartyInputFromConversation(
      {},
      [
        'Nome completo do cliente: Lucas Henrique Almeida Costa',
        'Telefone de contato: (11) 98888-7766',
        'E-mail: lucas.almeida.costa@email.com',
      ].join('\n'),
    ) as Record<string, unknown>;

    expect(hydrated).toEqual(
      expect.objectContaining({
        name: 'Lucas Henrique Almeida Costa',
        email: 'lucas.almeida.costa@email.com',
        phone: '(11) 98888-7766',
      }),
    );
  });
});
