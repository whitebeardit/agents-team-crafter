import type { IEnv } from '../../../config/env.js';
import type { VaultNoteIndexRepository, TVaultNoteIndexRow } from '../infra/vault-note-index.repository.js';
import type { VaultEmbeddingService } from './vault-embedding.service.js';

export type TSecondBrainRecallReason = 'ok' | 'no_relevant_memory' | 'budget_exhausted' | 'timeout' | 'disabled';

export type TSecondBrainRecallNote = {
  noteId: string;
  kind: string;
  title: string;
  excerpt: string;
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function scoreRow(topic: string, row: TVaultNoteIndexRow): number {
  const t = tokenize(topic);
  let score = row.confidence * 2;
  const hay = `${row.title} ${row.bodyPreview}`.toLowerCase();
  for (const w of t) {
    if (hay.includes(w)) score += 1;
  }
  return score;
}

const RRF_K = 60;

function rrfMerge(textOrder: TVaultNoteIndexRow[], semOrder: TVaultNoteIndexRow[]): TVaultNoteIndexRow[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, TVaultNoteIndexRow>();
  textOrder.forEach((r, i) => {
    byId.set(r.noteId, r);
    scores.set(r.noteId, (scores.get(r.noteId) ?? 0) + 1 / (RRF_K + i + 1));
  });
  semOrder.forEach((r, i) => {
    byId.set(r.noteId, r);
    scores.set(r.noteId, (scores.get(r.noteId) ?? 0) + 1 / (RRF_K + i + 1));
  });
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id))
    .filter((x): x is TVaultNoteIndexRow => Boolean(x));
}

export class SecondBrainRecallService {
  constructor(
    private readonly indexRepo: VaultNoteIndexRepository,
    private readonly embeddings: VaultEmbeddingService | null,
    private readonly env: IEnv,
  ) {}

  async recall(input: {
    workspaceId: string;
    topic: string;
    intent: string;
    agentId?: string;
    partyId?: string;
    kind?: string;
    limit?: number;
    tokenBudget?: number;
  }): Promise<{ notes: TSecondBrainRecallNote[]; applied: number; reason: TSecondBrainRecallReason }> {
    const topic = `${input.topic}\n${input.intent}`.trim();
    if (!topic) {
      return { notes: [], applied: 0, reason: 'no_relevant_memory' };
    }
    const filter: { status: 'active'; agentId?: string; partyId?: string; kind?: string } = { status: 'active' };
    if (input.agentId) filter.agentId = input.agentId;
    if (input.partyId) filter.partyId = input.partyId;
    if (input.kind) filter.kind = input.kind;

    const rows = await this.indexRepo.listByFilter(input.workspaceId, filter, 80);
    if (rows.length === 0) {
      return { notes: [], applied: 0, reason: 'no_relevant_memory' };
    }
    const scored = rows
      .map((r) => ({ r, s: scoreRow(topic, r) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    let list = scored.length > 0 ? scored.map((x) => x.r) : [...rows].sort((a, b) => b.confidence - a.confidence);

    if (this.env.EMBEDDINGS_ENABLED === '1' && this.embeddings?.isEnabled()) {
      try {
        const qVec = await this.embeddings.embedQuery(topic);
        const topK = this.env.EMBEDDINGS_TOPK ?? 20;
        const cap = this.env.EMBEDDINGS_CANDIDATE_CAP ?? 200;
        const sem = await this.embeddings.cosineSearch({
          workspaceId: input.workspaceId,
          queryVector: qVec,
          filter: {
            agentId: input.agentId,
            partyId: input.partyId,
            status: 'active',
          },
          topK,
          candidateCap: cap,
        });
        const semRows = sem.map((s) => s.row);
        if (semRows.length > 0) {
          list = rrfMerge(list, semRows);
        }
      } catch {
        /* fallback textual only */
      }
    }

    const max = Math.min(input.limit ?? 8, 20);
    const budget = input.tokenBudget ?? 1200;
    const notes: TSecondBrainRecallNote[] = [];
    let used = 0;
    for (const row of list.slice(0, max)) {
      const excerpt = row.bodyPreview.trim().slice(0, 600);
      const cost = Math.ceil((row.title.length + excerpt.length) / 4);
      if (used + cost > budget) {
        if (notes.length === 0) return { notes: [], applied: 0, reason: 'budget_exhausted' };
        break;
      }
      notes.push({
        noteId: row.noteId,
        kind: row.kind,
        title: row.title,
        excerpt,
      });
      used += cost;
    }
    if (notes.length === 0) {
      return { notes: [], applied: 0, reason: 'no_relevant_memory' };
    }
    return { notes, applied: notes.length, reason: 'ok' };
  }
}
