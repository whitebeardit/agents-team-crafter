import { Types } from 'mongoose';
import { ConversationTimelineModel } from './conversation-timeline.model.js';
import type { ConversationTimelineDoc } from './conversation-timeline.model.js';
import { ConversationTimelineSeqModel } from './conversation-timeline-seq.model.js';
import {
  createTimelineItem,
  type IConversationTimelineItem,
} from '../domain/conversation-timeline.js';

function mongoErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: number; cause?: unknown };
  if (typeof e.code === 'number') return e.code;
  return mongoErrorCode(e.cause);
}

function isDuplicateKeyError(err: unknown): boolean {
  return mongoErrorCode(err) === 11000;
}

function toPublic(doc: {
  _id: Types.ObjectId | string;
  workspaceId: Types.ObjectId | string;
  teamId: Types.ObjectId | string;
  runId: string;
  seq: number;
  timestamp: Date;
  actor: string;
  actorId?: string | null;
  kind: string;
  content: string;
  meta?: unknown;
  correlation?: { spanId?: string | null; parentSpanId?: string | null } | null;
}): IConversationTimelineItem {
  const idValue = typeof doc._id === 'string' ? doc._id : doc._id.toString();
  const workspaceIdValue =
    typeof doc.workspaceId === 'string' ? doc.workspaceId : doc.workspaceId.toString();
  const teamIdValue = typeof doc.teamId === 'string' ? doc.teamId : doc.teamId.toString();
  return {
    id: idValue,
    workspaceId: workspaceIdValue,
    teamId: teamIdValue,
    runId: doc.runId,
    seq: doc.seq,
    timestamp: doc.timestamp.toISOString(),
    actor: doc.actor as IConversationTimelineItem['actor'],
    actorId: doc.actorId ?? undefined,
    kind: doc.kind as IConversationTimelineItem['kind'],
    content: doc.content,
    meta: (doc.meta as Record<string, unknown> | undefined) ?? {},
    correlation: doc.correlation
      ? {
          spanId: doc.correlation.spanId ?? undefined,
          parentSpanId: doc.correlation.parentSpanId ?? undefined,
        }
      : undefined,
  };
}

export class ConversationTimelineRepository {
  private async maxSeqInTimeline(
    workspaceId: string,
    teamId: string,
    runId: string,
  ): Promise<number> {
    const row = await ConversationTimelineModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      runId,
    })
      .sort({ seq: -1 })
      .select({ seq: 1 })
      .lean<{ seq?: number }>()
      .exec();
    return row?.seq ?? 0;
  }

  /** @deprecated Usar alocação via contador; mantido para diagnóstico / scripts. */
  async nextSeq(workspaceId: string, teamId: string, runId: string): Promise<number> {
    return (await this.maxSeqInTimeline(workspaceId, teamId, runId)) + 1;
  }

  /**
   * Aloca o próximo seq num único findOneAndUpdate (MongoDB 4.2+ pipeline):
   * `issued := max(issued, maxTimelineSeq) + 1` — atómico e recupera contador atrasado.
   */
  async allocateSeq(workspaceId: string, teamId: string, runId: string): Promise<number> {
    const id = `${workspaceId}:${teamId}:${runId}`;
    const seed = await this.maxSeqInTimeline(workspaceId, teamId, runId);
    const doc = await ConversationTimelineSeqModel.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            issued: {
              $add: [
                {
                  $max: [{ $ifNull: ['$issued', seed] }, seed],
                },
                1,
              ],
            },
          },
        },
      ],
      { upsert: true, new: true },
    ).exec();
    if (!doc) {
      throw new Error('conversation timeline seq: counter missing after upsert');
    }
    return doc.issued;
  }

  async append(item: Omit<IConversationTimelineItem, 'id'>): Promise<IConversationTimelineItem> {
    const created = await ConversationTimelineModel.create({
      workspaceId: new Types.ObjectId(item.workspaceId),
      teamId: new Types.ObjectId(item.teamId),
      runId: item.runId,
      seq: item.seq,
      timestamp: new Date(item.timestamp),
      actor: item.actor,
      actorId: item.actorId,
      kind: item.kind,
      content: item.content,
      meta: item.meta ?? {},
      correlation: item.correlation ?? {},
    });
    return toPublic(created.toObject() as ConversationTimelineDoc);
  }

  /**
   * Usa contador atómico por run; retentativa rara se timeline e contador estiverem desalinhados.
   */
  async appendWithAutoSeq(
    input: Omit<IConversationTimelineItem, 'id' | 'seq' | 'timestamp'> & { timestamp?: string },
  ): Promise<IConversationTimelineItem> {
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seq = await this.allocateSeq(input.workspaceId, input.teamId, input.runId);
      const draft = createTimelineItem({ ...input, seq });
      try {
        return await this.append({
          workspaceId: draft.workspaceId,
          teamId: draft.teamId,
          runId: draft.runId,
          seq: draft.seq,
          timestamp: draft.timestamp,
          actor: draft.actor,
          actorId: draft.actorId,
          kind: draft.kind,
          content: draft.content,
          meta: draft.meta,
          correlation: draft.correlation,
        });
      } catch (err) {
        if (attempt < maxAttempts - 1 && isDuplicateKeyError(err)) continue;
        throw err;
      }
    }
    throw new Error('conversation timeline: appendWithAutoSeq exhausted retries');
  }

  async list(input: {
    workspaceId: string;
    teamId: string;
    runId?: string;
    cursorSeq?: number;
    limit: number;
  }): Promise<{ items: IConversationTimelineItem[]; nextCursorSeq?: number }> {
    const query: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(input.workspaceId),
      teamId: new Types.ObjectId(input.teamId),
    };
    if (input.runId) query.runId = input.runId;

    /**
     * Sem runId: últimos N eventos do time por tempo real (várias execuções).
     * Ordenar por seq global estava errado — misturava runs e podia devolver só inputs.
     */
    if (!input.runId) {
      const docs = await ConversationTimelineModel.find(query)
        .sort({ timestamp: -1 })
        .limit(input.limit)
        .exec();
      const items = docs.map((d) => toPublic(d.toObject() as ConversationTimelineDoc));
      items.sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) || a.runId.localeCompare(b.runId) || a.seq - b.seq,
      );
      return { items, nextCursorSeq: undefined };
    }

    if (typeof input.cursorSeq === 'number') query.seq = { $lt: input.cursorSeq };
    const docs = await ConversationTimelineModel.find(query)
      .sort({ seq: -1, timestamp: -1 })
      .limit(input.limit)
      .exec();
    const items = docs.map((d) => toPublic(d.toObject() as ConversationTimelineDoc));
    const ordered = [...items].sort((a, b) => a.seq - b.seq);
    const nextCursorSeq = items.length === input.limit ? items[items.length - 1]?.seq : undefined;
    return { items: ordered, nextCursorSeq };
  }
}
