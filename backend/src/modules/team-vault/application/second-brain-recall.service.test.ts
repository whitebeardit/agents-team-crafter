import { describe, expect, it, jest } from '@jest/globals';
import type { IEnv } from '../../../config/env.js';
import type { VaultNoteIndexRepository, TVaultNoteIndexRow } from '../infra/vault-note-index.repository.js';
import { SecondBrainRecallService } from './second-brain-recall.service.js';

function mkRow(noteId: string, partyId?: string, agentId = 'ag1'): TVaultNoteIndexRow {
  return {
    id: 'x',
    agentId,
    noteId,
    notePath: `${noteId}.md`,
    status: 'active',
    kind: 'fact',
    tags: [],
    confidence: 0.6,
    tokens: 10,
    version: 1,
    contentHash: 'h',
    title: 't',
    bodyPreview: 'alpha beta topic',
    ...(partyId ? { partyId } : {}),
  };
}

describe('SecondBrainRecallService', () => {
  it('passa partyId ao listByFilter quando filtrar por cliente', async () => {
    const listByFilter = jest.fn(async (_ws: string, filter: { partyId?: string }) => {
      if (filter.partyId === 'party-1') return [mkRow('n1', 'party-1')];
      return [mkRow('n2', 'party-2'), mkRow('n1', 'party-1')];
    });
    const indexRepo = { listByFilter } as unknown as VaultNoteIndexRepository;
    const env = { EMBEDDINGS_ENABLED: '0' } as IEnv;
    const svc = new SecondBrainRecallService(indexRepo, null, env);
    const r = await svc.recall({
      workspaceId: 'ws',
      topic: 'topic words',
      intent: 'intent',
      partyId: 'party-1',
    });
    expect(listByFilter).toHaveBeenCalledWith(
      'ws',
      expect.objectContaining({ status: 'active', partyId: 'party-1' }),
      80,
    );
    expect(r.notes.some((n) => n.noteId === 'n1')).toBe(true);
    expect(r.notes.some((n) => n.noteId === 'n2')).toBe(false);
  });
});
