import type { BusinessToolRegistry } from './business-tool-registry.js';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';
import { validateBusinessActionInput } from './business-action-input-validation.js';
import { normalizeBusinessActionInput } from './business-action-input-normalization.js';

const MAX_SAFE_EXECUTION_RETRIES = 1;
const RETRYABLE_EXECUTION_ERROR_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /temporar/i,
  /unavailable/i,
  /rate limit/i,
  /too many requests/i,
  /econnreset/i,
  /econnrefused/i,
  /\b429\b/,
  /\b502\b/,
  /\b503\b/,
  /\b504\b/,
];

function isRetrySafeActionId(actionId: string): boolean {
  if (actionId === 'business.ping') return true;
  return /(_find_|_list_|_get_|_summary|_top_|_total_|_balance)/.test(actionId);
}

function isTransientExecutionError(message: string): boolean {
  return RETRYABLE_EXECUTION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

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
    const rawInput = params.input;
    const normalizedInput = normalizeBusinessActionInput(actionId, rawInput);
    const handler = this.registry.get(actionId);
    if (!handler) {
      await this.auditRepo.append({
        workspaceId: params.workspaceId,
        toolDefinitionId: params.toolDefinitionId,
        actionId,
        ok: false,
        errorCode: 'UNKNOWN_ACTION',
        rawInput,
        normalizedInput,
        submittedInput: normalizedInput,
        validationResult: { ok: false, reason: 'UNKNOWN_ACTION' },
        correlationId: params.correlationId,
      });
      return { ok: false, error: `Acao interna desconhecida: ${actionId}`, errorCode: 'UNKNOWN_ACTION' };
    }

    const validation = validateBusinessActionInput(actionId, normalizedInput);
    if (!validation.ok) {
      const missing = validation.missingFields;
      await this.auditRepo.append({
        workspaceId: params.workspaceId,
        toolDefinitionId: params.toolDefinitionId,
        actionId,
        ok: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        rawInput,
        normalizedInput,
        submittedInput: normalizedInput,
        missingFields: missing,
        validationResult: { ok: false, missingFields: missing },
        result: { missingFields: missing, submittedInput: normalizedInput },
        correlationId: params.correlationId,
      });
      return {
        ok: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        error: `Campos obrigatorios em falta: ${missing.join(', ')}`,
        result: { missingFields: missing, submittedInput: normalizedInput },
      };
    }

    for (let attempt = 0; attempt <= MAX_SAFE_EXECUTION_RETRIES; attempt++) {
      try {
        const result = await handler({
          workspaceId: params.workspaceId,
          input: normalizedInput,
          correlationId: params.correlationId,
        });
        await this.auditRepo.append({
          workspaceId: params.workspaceId,
          toolDefinitionId: params.toolDefinitionId,
          actionId,
          ok: true,
          rawInput,
          normalizedInput,
          submittedInput: normalizedInput,
          validationResult: { ok: true },
          result,
          correlationId: params.correlationId,
        });
        return { ok: true, result };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const retrySafe = isRetrySafeActionId(actionId);
        const transient = isTransientExecutionError(msg);
        const canRetry = attempt < MAX_SAFE_EXECUTION_RETRIES && retrySafe && transient;
        const retryMeta = {
          attempt: attempt + 1,
          maxAttempts: MAX_SAFE_EXECUTION_RETRIES + 1,
          retrySafeAction: retrySafe,
          transientError: transient,
          canRetry,
        };

        if (canRetry) {
          await this.auditRepo.append({
            workspaceId: params.workspaceId,
            toolDefinitionId: params.toolDefinitionId,
            actionId,
            ok: false,
            errorCode: 'EXECUTION_RETRY',
            rawInput,
            normalizedInput,
            submittedInput: normalizedInput,
            validationResult: { ok: true },
            result: { message: msg, submittedInput: normalizedInput, retry: retryMeta },
            correlationId: params.correlationId,
          });
          continue;
        }

        await this.auditRepo.append({
          workspaceId: params.workspaceId,
          toolDefinitionId: params.toolDefinitionId,
          actionId,
          ok: false,
          errorCode: 'EXECUTION_ERROR',
          rawInput,
          normalizedInput,
          submittedInput: normalizedInput,
          validationResult: { ok: true },
          result: { message: msg, submittedInput: normalizedInput, retry: retryMeta },
          correlationId: params.correlationId,
        });
        return {
          ok: false,
          error: msg,
          errorCode: 'EXECUTION_ERROR',
          result: { submittedInput: normalizedInput, retry: retryMeta },
        };
      }
    }
    return { ok: false, error: 'Falha inesperada no boundary de execução.', errorCode: 'EXECUTION_ERROR' };
  }
}
