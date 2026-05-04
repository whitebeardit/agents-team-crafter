import type { VaultNoteIndexRepository, TVaultNoteIndexRow } from '../infra/vault-note-index.repository.js';

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

export class SecondBrainRecallService {
  constructor(private readonly indexRepo: VaultNoteIndexRepository) {}

  async recall(input: {
    workspaceId: string;
    topic: string;
    intent: string;
    agentId?: string;
    kind?: string;
    limit?: number;
    tokenBudget?: number;
  }): Promise<{ notes: TSecondBrainRecallNote[]; applied: number; reason: TSecondBrainRecallReason }> {
    const topic = `${input.topic}\n${input.intent}`.trim();
    if (!topic) {
      return { notes: [], applied: 0, reason: 'no_relevant_memory' };
    }
    const rows = await this.indexRepo.listByFilter(
      input.workspaceId,
      { status: 'active', ...(input.agentId ? { agentId: input.agentId } : {}), ...(input.kind ? { kind: input.kind } : {}) },
      80,
    );
    if (rows.length === 0) {
      return { notes: [], applied: 0, reason: 'no_relevant_memory' };
    }
    const scored = rows
      .map((r) => ({ r, s: scoreRow(topic, r) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const list = scored.length > 0 ? scored.map((x) => x.r) : rows.sort((a, b) => b.confidence - a.confidence);
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
