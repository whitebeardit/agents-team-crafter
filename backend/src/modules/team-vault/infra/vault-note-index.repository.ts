import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { VaultNoteIndexModel } from './vault-note-index.model.js';

export type TVaultNoteIndexRow = {
  id: string;
  agentId: string;
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
};

function toRow(doc: Record<string, unknown>): TVaultNoteIndexRow {
  return {
    id: String(doc['_id']),
    agentId: String(doc['agentId']),
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
  };
}

export function hashVaultContent(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export class VaultNoteIndexRepository {
  async upsert(workspaceId: string, row: Omit<TVaultNoteIndexRow, 'id'>): Promise<void> {
    await VaultNoteIndexModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), noteId: row.noteId },
      {
        $set: {
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
        },
      },
      { upsert: true },
    );
  }

  async deleteByNoteId(workspaceId: string, noteId: string): Promise<void> {
    await VaultNoteIndexModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      noteId,
    });
  }

  async listByFilter(
    workspaceId: string,
    filter: { agentId?: string; status?: string; kind?: string; tag?: string },
    limit = 50,
  ): Promise<TVaultNoteIndexRow[]> {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filter.agentId) q.agentId = filter.agentId;
    if (filter.status) q.status = filter.status;
    if (filter.kind) q.kind = filter.kind;
    if (filter.tag) q.tags = filter.tag;
    const docs = await VaultNoteIndexModel.find(q).sort({ confidence: -1, updatedAt: -1 }).limit(limit).lean();
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
