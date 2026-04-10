import type { BusinessToolRegistry } from './business-tool-registry.js';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';

export interface IBusinessToolRuntime {
  execute(params: {
    workspaceId: string;
    toolDefinitionId: string;
    actionId: string;
    input: unknown;
    correlationId?: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string; errorCode?: string }>;
}

export class BusinessToolRuntime implements IBusinessToolRuntime {
  constructor(
    private readonly registry: BusinessToolRegistry,
    private readonly auditRepo: BusinessToolAuditRepository,
  ) {}

  async execute(params: {
    workspaceId: string;
    toolDefinitionId: string;
    actionId: string;
    input: unknown;
    correlationId?: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string; errorCode?: string }> {
    const actionId = params.actionId.trim();
    const handler = this.registry.get(actionId);
    if (!handler) {
      await this.auditRepo.append({
        workspaceId: params.workspaceId,
        toolDefinitionId: params.toolDefinitionId,
        actionId,
        ok: false,
        errorCode: 'UNKNOWN_ACTION',
        input: params.input,
        correlationId: params.correlationId,
      });
      return { ok: false, error: `Acao interna desconhecida: ${actionId}`, errorCode: 'UNKNOWN_ACTION' };
    }

    try {
      const result = await handler({
        workspaceId: params.workspaceId,
        input: params.input,
        correlationId: params.correlationId,
      });
      await this.auditRepo.append({
        workspaceId: params.workspaceId,
        toolDefinitionId: params.toolDefinitionId,
        actionId,
        ok: true,
        input: params.input,
        result,
        correlationId: params.correlationId,
      });
      return { ok: true, result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.auditRepo.append({
        workspaceId: params.workspaceId,
        toolDefinitionId: params.toolDefinitionId,
        actionId,
        ok: false,
        errorCode: 'EXECUTION_ERROR',
        input: params.input,
        result: { message: msg },
        correlationId: params.correlationId,
      });
      return { ok: false, error: msg, errorCode: 'EXECUTION_ERROR' };
    }
  }
}
