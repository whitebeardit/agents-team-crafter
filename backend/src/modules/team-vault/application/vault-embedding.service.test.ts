import { describe, expect, it, jest } from '@jest/globals';
import type { IEnv } from '../../../config/env.js';
import type { OpenAiEmbeddingsClient } from '../infra/openai-embeddings.client.js';
import type { VaultNoteIndexRepository, TVaultNoteIndexRow } from '../infra/vault-note-index.repository.js';
import { VaultEmbeddingService } from './vault-embedding.service.js';
import type { VaultWriterService } from './vault-writer.service.js';

function row(partial: Partial<TVaultNoteIndexRow> & Pick<TVaultNoteIndexRow, 'noteId' | 'agentId'>): TVaultNoteIndexRow {
  const base: TVaultNoteIndexRow = {
    id: 'i',
    agentId: partial.agentId,
    noteId: partial.noteId,
    notePath: partial.notePath ?? 'x.md',
    status: partial.status ?? 'active',
    kind: partial.kind ?? 'fact',
    tags: partial.tags ?? [],
    confidence: partial.confidence ?? 0.5,
    tokens: partial.tokens ?? 10,
    version: partial.version ?? 1,
    contentHash: partial.contentHash ?? 'h',
    title: partial.title ?? 't',
    bodyPreview: partial.bodyPreview ?? 'b',
  };
  return { ...base, ...partial };
}

describe('VaultEmbeddingService', () => {
  it('cosineSearch ordena por similaridade deterministica', async () => {
    const env = {
      EMBEDDINGS_ENABLED: '1',
      OPENAI_API_KEY: 'k',
    } as IEnv;
    const client = {} as OpenAiEmbeddingsClient;
    const r1 = row({
      noteId: 'a',
      agentId: 'ag',
      embedding: { vector: [1, 0, 0], model: 'm', dim: 3, embeddedAtHash: 'h', ts: new Date().toISOString() },
    });
    const r2 = row({
      noteId: 'b',
      agentId: 'ag',
      embedding: {
        vector: [0.707, 0.707, 0],
        model: 'm',
        dim: 3,
        embeddedAtHash: 'h',
        ts: new Date().toISOString(),
      },
    });
    const indexRepo = {
      listEmbeddingCandidates: jest.fn(async () => [r2, r1]),
    } as unknown as VaultNoteIndexRepository;
    const svc = new VaultEmbeddingService(env, client, indexRepo);
    const out = await svc.cosineSearch({
      workspaceId: 'ws',
      queryVector: [1, 0, 0],
      filter: { status: 'active' },
      topK: 5,
      candidateCap: 50,
    });
    expect(out.map((x) => x.row.noteId)).toEqual(['a', 'b']);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('embedNoteIfStale nao chama API quando embeddedAtHash coincide com contentHash', async () => {
    const env = { EMBEDDINGS_ENABLED: '1', OPENAI_API_KEY: 'k' } as IEnv;
    const embedText = jest.fn();
    const client = { embedText } as unknown as OpenAiEmbeddingsClient;
    const setEmbedding = jest.fn();
    const findByNoteId = jest.fn(async () =>
      row({
        noteId: 'n1',
        agentId: 'ag',
        notePath: 'p.md',
        contentHash: 'same',
        embedding: {
          vector: [1, 0],
          model: 'm',
          dim: 2,
          embeddedAtHash: 'same',
          ts: new Date().toISOString(),
        },
      }),
    );
    const indexRepo = { findByNoteId, setEmbedding, listEmbeddingCandidates: jest.fn() } as unknown as VaultNoteIndexRepository;
    const svc = new VaultEmbeddingService(env, client, indexRepo);
    const writer = { readNoteRaw: jest.fn() } as unknown as VaultWriterService;
    svc.setVaultWriter(writer);
    await svc.embedNoteIfStale('ws', 'n1');
    expect(embedText).not.toHaveBeenCalled();
    expect(writer.readNoteRaw).not.toHaveBeenCalled();
    expect(setEmbedding).not.toHaveBeenCalled();
  });
});
