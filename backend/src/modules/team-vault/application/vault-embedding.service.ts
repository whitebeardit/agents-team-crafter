import type { IEnv } from '../../../config/env.js';
import type { VaultNoteIndexRepository, TVaultNoteIndexRow } from '../infra/vault-note-index.repository.js';
import type { OpenAiEmbeddingsClient } from '../infra/openai-embeddings.client.js';
import type { VaultWriterService } from './vault-writer.service.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 0 ? dot / d : 0;
}

const queryCache = new Map<string, { expires: number; vector: number[] }>();
const QUERY_CACHE_TTL_MS = 120_000;
const QUERY_CACHE_MAX = 200;

function cacheQueryKey(text: string): string {
  return text.slice(0, 2000).toLowerCase();
}

export class VaultEmbeddingService {
  private vaultWriter: VaultWriterService | null = null;

  constructor(
    private readonly env: IEnv,
    private readonly client: OpenAiEmbeddingsClient,
    private readonly indexRepo: VaultNoteIndexRepository,
  ) {}

  setVaultWriter(w: VaultWriterService): void {
    this.vaultWriter = w;
  }

  isEnabled(): boolean {
    return this.env.EMBEDDINGS_ENABLED === '1' && Boolean(this.env.OPENAI_API_KEY?.trim());
  }

  async embedQuery(text: string): Promise<number[]> {
    const key = cacheQueryKey(text);
    const now = Date.now();
    const hit = queryCache.get(key);
    if (hit && hit.expires > now) return hit.vector;
    const r = await this.client.embedText(text);
    if (queryCache.size > QUERY_CACHE_MAX) {
      const first = queryCache.keys().next().value;
      if (first) queryCache.delete(first);
    }
    queryCache.set(key, { expires: now + QUERY_CACHE_TTL_MS, vector: r.vector });
    return r.vector;
  }

  async cosineSearch(input: {
    workspaceId: string;
    queryVector: number[];
    filter: { agentId?: string; partyId?: string; status?: string };
    topK: number;
    candidateCap: number;
  }): Promise<Array<{ row: TVaultNoteIndexRow; score: number }>> {
    const rows = await this.indexRepo.listEmbeddingCandidates(
      input.workspaceId,
      { ...input.filter, status: input.filter.status ?? 'active' },
      input.candidateCap,
    );
    const scored = rows
      .map((row) => {
        const v = row.embedding?.vector;
        if (!v?.length) return null;
        return { row, score: cosineSimilarity(input.queryVector, v) };
      })
      .filter((x): x is { row: TVaultNoteIndexRow; score: number } => x !== null && x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.topK);
    return scored;
  }

  /** Re-embed quando o hash do documento mudou (fire-and-forget). */
  async embedNoteIfStale(workspaceId: string, noteId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const w = this.vaultWriter;
    if (!w) return;
    const row = await this.indexRepo.findByNoteId(workspaceId, noteId);
    if (!row) return;
    if (row.embedding?.embeddedAtHash === row.contentHash) return;
    const raw = await w.readNoteRaw(workspaceId, row.notePath);
    const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
    const text = `${row.title}\n${body}\n${row.tags.join(' ')}`.slice(0, 12_000);
    const emb = await this.client.embedText(text);
    await this.indexRepo.setEmbedding(workspaceId, noteId, {
      vector: emb.vector,
      model: emb.model,
      dim: emb.dim,
      embeddedAtHash: row.contentHash,
      ts: new Date().toISOString(),
    });
  }
}
