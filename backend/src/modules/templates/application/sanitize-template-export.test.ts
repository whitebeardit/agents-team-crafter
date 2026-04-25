import { AGENT_EXPORT_VERSION } from '../../agents/application/build-agent-export.js';
import { assertTemplatePayloadHasNoEncryptedSecrets, sanitizeTeamExportToTemplate } from './sanitize-template-export.js';
import type { TTeamExportPayload } from '../../teams/application/build-team-export.js';

function baseExport(): TTeamExportPayload {
  return {
    exportVersion: AGENT_EXPORT_VERSION,
    exportKind: 'team',
    exportedAt: '2020-01-01T00:00:00.000Z',
    team: {
      id: 't1',
      name: 'T',
      coordinatorId: 'c1',
      agentIds: ['c1'],
      channelIds: ['ch1'],
    },
    graph: { nodes: [], edges: [] },
    channels: [
      { id: 'ch1', type: 'whatsapp', name: 'W', status: 'connected' },
    ],
    channelsFull: [
      {
        legacyId: 'ch1',
        type: 'whatsapp',
        name: 'W',
        status: 'connected',
        provider: 'chat_sdk',
        platform: 'whatsapp',
        config: { apiToken: 'X' },
        secretsEncrypted: {
          algorithm: 'aes-256-gcm',
          keyVersion: 1,
          iv: 'a',
          ciphertext: 'b',
          authTag: 'c',
        },
      },
    ],
    agents: [
      {
        exportVersion: AGENT_EXPORT_VERSION,
        exportKind: 'agent' as const,
        exportedAt: '2020-01-01T00:00:00.000Z',
        agent: {
          id: 'c1',
          name: 'C',
          role: 'coordinator',
          security: { token: 'secret' },
        } as never,
        mcpBindings: [],
        sections: {} as never,
      },
    ],
  };
}

describe('sanitizeTeamExportToTemplate', () => {
  it('produz exportKind template e remove secrets dos canais', () => {
    const t = sanitizeTeamExportToTemplate(baseExport());
    expect(t.exportKind).toBe('template');
    expect(t.channelsFull![0]!.secretsEncrypted).toBeUndefined();
    expect((t.channelsFull![0]! as { secretRequired?: boolean }).secretRequired).toBe(true);
  });

  it('remove chaves sensiveis de agente', () => {
    const t = sanitizeTeamExportToTemplate(baseExport());
    const ag = t.agents[0]!.agent as Record<string, unknown>;
    expect(ag['security']).toBeUndefined();
  });

  it('assertTemplatePayloadHasNoEncryptedSecrets aceita template sanitizado', () => {
    const r = assertTemplatePayloadHasNoEncryptedSecrets(sanitizeTeamExportToTemplate(baseExport()));
    expect(r.ok).toBe(true);
  });
});
