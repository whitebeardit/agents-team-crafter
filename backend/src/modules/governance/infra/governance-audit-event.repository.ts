import { Types } from 'mongoose';
import { GovernanceAuditEventModel } from './governance-audit-event.model.js';
import type { GovernanceAuditEventDoc } from './governance-audit-event.model.js';
import type { TGovernanceAuditEventType } from '../domain/governance-audit.types.js';

export interface IGovernanceAuditEventPublic {
  id: string;
  workspaceId: string;
  userId?: string;
  correlationId?: string;
  eventType: TGovernanceAuditEventType;
  payload: Record<string, unknown>;
  createdAt?: string;
}

function toPublic(doc: GovernanceAuditEventDoc): IGovernanceAuditEventPublic {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    userId: doc.userId?.toString(),
    correlationId: doc.correlationId ?? undefined,
    eventType: doc.eventType as TGovernanceAuditEventType,
    payload: (doc.payload as Record<string, unknown>) ?? {},
    createdAt: doc.createdAt?.toISOString(),
  };
}

export class GovernanceAuditEventRepository {
  async append(entry: {
    workspaceId: string;
    userId?: string;
    correlationId?: string;
    eventType: TGovernanceAuditEventType;
    payload?: Record<string, unknown>;
  }) {
    const doc = await GovernanceAuditEventModel.create({
      workspaceId: new Types.ObjectId(entry.workspaceId),
      userId: entry.userId ? new Types.ObjectId(entry.userId) : undefined,
      correlationId: entry.correlationId,
      eventType: entry.eventType,
      payload: entry.payload ?? {},
    });
    return toPublic(doc as GovernanceAuditEventDoc);
  }

  async list(workspaceId: string, opts?: { limit?: number; eventType?: TGovernanceAuditEventType }) {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (opts?.eventType) q.eventType = opts.eventType;
    const docs = await GovernanceAuditEventModel.find(q)
      .sort({ createdAt: -1 })
      .limit(opts?.limit ?? 50)
      .exec();
    return docs.map((d) => toPublic(d as GovernanceAuditEventDoc));
  }

  async listPaged(
    workspaceId: string,
    opts: { page: number; perPage: number; eventType?: TGovernanceAuditEventType },
  ): Promise<{ items: IGovernanceAuditEventPublic[]; total: number }> {
    const q: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (opts.eventType) q.eventType = opts.eventType;
    const skip = (opts.page - 1) * opts.perPage;
    const [total, docs] = await Promise.all([
      GovernanceAuditEventModel.countDocuments(q),
      GovernanceAuditEventModel.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(opts.perPage)
        .exec(),
    ]);
    return {
      items: docs.map((d) => toPublic(d as GovernanceAuditEventDoc)),
      total,
    };
  }

  async countSince(workspaceId: string, since: Date) {
    return GovernanceAuditEventModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      createdAt: { $gte: since },
    });
  }

  async existsSloBreachForTeamSince(workspaceId: string, teamId: string, since: Date): Promise<boolean> {
    const n = await GovernanceAuditEventModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      eventType: 'governance.slo_breached',
      'payload.teamId': teamId,
      createdAt: { $gte: since },
    });
    return n > 0;
  }

  async aggregateAuditCountByDay(
    workspaceId: string,
    sinceStartOfFirstDayUtc: Date,
    until: Date,
    dayKeysUtc: string[],
  ): Promise<Array<{ date: string; count: number }>> {
    const oid = new Types.ObjectId(workspaceId);
    const rows = await GovernanceAuditEventModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          workspaceId: oid,
          createdAt: { $gte: sinceStartOfFirstDayUtc, $lte: until },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const map = new Map<string, number>();
    for (const k of dayKeysUtc) map.set(k, 0);
    for (const r of rows) {
      const day = r._id;
      map.set(day, (map.get(day) ?? 0) + r.count);
    }
    return dayKeysUtc.map((date) => ({ date, count: map.get(date) ?? 0 }));
  }

  /**
   * Remove eventos de auditoria do workspace. Destinado a administradores (operacao de limpeza).
   */
  async purge(
    workspaceId: string,
    opts: { scope: 'all' } | { scope: 'range'; from: Date; to: Date },
  ): Promise<number> {
    const oid = new Types.ObjectId(workspaceId);
    if (opts.scope === 'all') {
      const r = await GovernanceAuditEventModel.deleteMany({ workspaceId: oid });
      return r.deletedCount ?? 0;
    }
    const r = await GovernanceAuditEventModel.deleteMany({
      workspaceId: oid,
      createdAt: { $gte: opts.from, $lte: opts.to },
    });
    return r.deletedCount ?? 0;
  }
}
