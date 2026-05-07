import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { VaultNoteIndexModel } from './vault-note-index.model.js';

export type TVaultNoteEmbeddingRow = {
  vector: number[];
  model: string;
  dim: number;
  embeddedAtHash: string;
  ts: string;
};

export type TVaultNoteIndexRow = {
  id: string;
  agentId: string;
  partyId?: string;
  partySlug?: string;
  noteId: string;
  notePath: string;
  status: string;
  kind: string;
  tags: string[];
  confidence: number;
  tokens: number;
  version: number;
  supersedesNoteId?: string;
  contentHash: string;
  title: string;
  bodyPreview: string;
  lastGitCommit?: string;
  embedding?: TVaultNoteEmbeddingRow;
};

function toRow(doc: Record<string, unknown>): TVaultNoteIndexRow {
  const embRaw = doc['embedding'] as Record<string, unknown> | undefined;
  let embedding: TVaultNoteEmbeddingRow | undefined;
  if (embRaw && Array.isArray(embRaw['vector']) && embRaw['vector'].length > 0) {
    embedding = {
      vector: (embRaw['vector'] as number[]).map((n) => Number(n)),
      model: String(embRaw['model'] ?? ''),
      dim: Number(embRaw['dim'] ?? 0),
      embeddedAtHash: String(embRaw['embeddedAtHash'] ?? ''),
      ts:
        embRaw['ts'] instanceof Date
          ? (embRaw['ts'] as Date).toISOString()
          : String(embRaw['ts'] ?? new Date().toISOString()),
    };
  }
  return {
    id: String(doc['_id']),
    agentId: String(doc['agentId']),
    ...(doc['partyId'] ? { partyId: String(doc['partyId']) } : {}),
    ...(doc['partySlug'] ? { partySlug: String(doc['partySlug']) } : {}),
    noteId: String(doc['noteId']),
    notePath: String(doc['notePath']),
    status: String(doc['status']),
    kind: String(doc['kind']),
    tags: Array.isArray(doc['tags']) ? (doc['tags'] as string[]) : [],
    confidence: Number(doc['confidence'] ?? 0),
    tokens: Number(doc['tokens'] ?? 0),
    version: Number(doc['version'] ?? 1),
    supersedesNoteId: doc['supersedesNoteId'] ? String(doc['supersedesNoteId']) : undefined,
    contentHash: String(doc['contentHash']),
    title: String(doc['title'] ?? ''),
    bodyPreview: String(doc['bodyPreview'] ?? ''),
    lastGitCommit: doc['lastGitCommit'] ? String(doc['lastGitCommit']) : undefined,
    ...(embedding ? { embedding } : {}),
  };
}

export function hashVaultContent(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export class VaultNoteIndexRepository {
  async upsert(workspaceId: string, row: Omit<TVaultNoteIndexRow, 'id' | 'embedding'>): Promise<void> {
    const $set: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      agentId: row.agentId,
      notePath: row.notePath,
      status: row.status,
      kind: row.kind,
      tags: row.tags,
      confidence: row.confidence,
      tokens: row.tokens,
      version: row.version,
      supersedesNoteId: row.supersedesNoteId,
      contentHash: row.contentHash,
      title: row.title,
      bodyPreview: row.bodyPreview,
      lastGitCommit: row.lastGitCommit,
    };
    if (row.partyId) $set.partyId = row.partyId;
    else $set.partyId = null;
    if (row.partySlug) $set.partySlug = row.partySlug;
    else $set.partySlug = null;
    await VaultNoteIndexModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), noteId: row.noteId },
      { $set },
      { upsert: true },
    );
  }

  async setEmbedding(
    workspaceId: string,
    noteId: string,
    embedding: Omit<TVaultNoteEmbeddingRow, 'ts'> & { ts?: string },
  ): Promise<void> {
    await VaultNoteIndexModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId), noteId },
      {
        $set: {
          embedding: {
            vector: embedding.vector,
            model: embedding.model,
            dim: embedding.dim,
            embeddedAtHash: embedding.embeddedAtHash,
            ts: embedding.ts ? new Date(embedding.ts) : new Date(),
          },
        },
      },
    ).exec();
  }

  async findByNoteId(workspaceId: string, noteId: string): Promise<TVaultNoteIndexRow | null> {
    const doc = await VaultNoteIndexModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      noteId,
    })
      .lean()
      .exec();
    return doc ? toRow(doc as Record<string, unknown>) : null;
  }

  async deleteByNoteId(workspaceId: string, noteId: string): Promise<void> {
    await VaultNoteIndexModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      noteId,
    });
  }

  async listByFilter(
    workspaceId: string,
    filter: {
      agentId?: string;
      agentIds?: string[];
      partyId?: string;
      partySlug?: string;
      status?: string;
      kind?: string;
      tag?: string;
    },
    limit = 50,
  ): Promise<TVaultNoteIndexRow[]> {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filter.agentId) q.agentId = filter.agentId;
    else if (filter.agentIds && filter.agentIds.length > 0) {
      q.agentId = { $in: filter.agentIds };
    }
    if (filter.partyId) q.partyId = filter.partyId;
    if (filter.partySlug) q.partySlug = filter.partySlug;
    if (filter.status) q.status = filter.status;
    if (filter.kind) q.kind = filter.kind;
    if (filter.tag) q.tags = filter.tag;
    const docs = await VaultNoteIndexModel.find(q).sort({ confidence: -1, updatedAt: -1 }).limit(limit).lean();
    return docs.map((d) => toRow(d as Record<string, unknown>));
  }

  /** Candidatos para cosine search (embeddings); cap externo recomendado ~200. */
  async listEmbeddingCandidates(
    workspaceId: string,
    filter: { agentId?: string; partyId?: string; status?: string },
    limit: number,
  ): Promise<TVaultNoteIndexRow[]> {
    const q: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      'embedding.vector.0': { $exists: true },
    };
    if (filter.status) q.status = filter.status;
    if (filter.agentId) q.agentId = filter.agentId;
    if (filter.partyId) q.partyId = filter.partyId;
    const docs = await VaultNoteIndexModel.find(q).limit(limit).lean();
    return docs.map((d) => toRow(d as Record<string, unknown>));
  }

  async findDuplicateContentHash(
    workspaceId: string,
    agentId: string,
    contentHash: string,
    excludeNoteId?: string,
  ): Promise<TVaultNoteIndexRow | null> {
    const q: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
      agentId,
      contentHash,
      status: { $in: ['proposed', 'active'] },
    };
    if (excludeNoteId) q.noteId = { $ne: excludeNoteId };
    const doc = await VaultNoteIndexModel.findOne(q).lean();
    return doc ? toRow(doc as Record<string, unknown>) : null;
  }

  async countProposedSinceHour(workspaceId: string, hourStart: Date): Promise<number> {
    return VaultNoteIndexModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'proposed',
      createdAt: { $gte: hourStart },
    });
  }
}
