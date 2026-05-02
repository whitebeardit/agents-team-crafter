import { Types } from 'mongoose';
import { ConversationTimelineModel } from './conversation-timeline.model.js';
import type { ConversationTimelineDoc } from './conversation-timeline.model.js';
import type { IConversationTimelineItem } from '../domain/conversation-timeline.js';

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
  async nextSeq(workspaceId: string, teamId: string, runId: string): Promise<number> {
    const row = await ConversationTimelineModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      runId,
    })
      .sort({ seq: -1 })
      .select({ seq: 1 })
      .lean<{ seq?: number }>()
      .exec();
    return (row?.seq ?? 0) + 1;
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
