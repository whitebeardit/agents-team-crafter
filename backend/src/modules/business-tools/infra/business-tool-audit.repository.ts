import { Types } from 'mongoose';
import { BusinessToolAuditModel } from './business-tool-audit.model.js';

function preview(v: unknown, max = 2000): string {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
  } catch {
    return '[unserializable]';
  }
}

export class BusinessToolAuditRepository {
  async append(entry: {
    workspaceId: string;
    toolDefinitionId: string;
    actionId: string;
    ok: boolean;
    errorCode?: string;
    input?: unknown;
    result?: unknown;
    correlationId?: string;
  }): Promise<void> {
    await BusinessToolAuditModel.create({
      workspaceId: new Types.ObjectId(entry.workspaceId),
      toolDefinitionId: entry.toolDefinitionId,
      actionId: entry.actionId,
      ok: entry.ok,
      errorCode: entry.errorCode,
      inputPreview: entry.input !== undefined ? preview(entry.input) : undefined,
      resultPreview: entry.result !== undefined ? preview(entry.result) : undefined,
      correlationId: entry.correlationId,
    });
  }
}
