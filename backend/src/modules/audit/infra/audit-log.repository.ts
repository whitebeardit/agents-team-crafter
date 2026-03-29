import { Types } from 'mongoose';
import { AuditLogModel } from './audit-log.model.js';

export class AuditLogRepository {
  async append(entry: {
    workspaceId: string;
    userId?: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    correlationId: string;
  }) {
    await AuditLogModel.create({
      workspaceId: new Types.ObjectId(entry.workspaceId),
      userId: entry.userId ? new Types.ObjectId(entry.userId) : undefined,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      correlationId: entry.correlationId,
    });
  }

  async list(workspaceId: string, limit = 50) {
    const docs = await AuditLogModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => {
      const x = d as unknown as {
        _id: unknown;
        method: string;
        path: string;
        statusCode?: number;
        durationMs?: number;
        userId?: Types.ObjectId;
        correlationId?: string;
        createdAt?: Date;
      };
      return {
        id: String(x._id),
        method: x.method,
        path: x.path,
        statusCode: x.statusCode,
        durationMs: x.durationMs,
        userId: x.userId?.toString(),
        correlationId: x.correlationId,
        createdAt: x.createdAt?.toISOString(),
      };
    });
  }
}
