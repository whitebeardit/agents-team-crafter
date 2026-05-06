import type { BusinessToolRegistry } from './business-tool-registry.js';
import type { BusinessToolAuditRepository } from '../infra/business-tool-audit.repository.js';
import { validateBusinessActionInput } from './business-action-input-validation.js';
import { normalizeBusinessActionInput } from './business-action-input-normalization.js';
import pino from 'pino';
import { recordClinicActionMetrics } from '../../../app/metrics.js';

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
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

function mapClinicDomainEvent(actionId: string, status: 'success' | 'error' | 'verification_failed'): string {
  if (status === 'verification_failed') return 'clinic.verification.failed';
  if (actionId === 'clinic_create_patient') return 'clinic.patient.created';
  if (actionId === 'clinic_sell_default_package') return 'clinic.package.sold';
  if (actionId === 'clinic_schedule_session_by_phone') return 'clinic.session.scheduled';
  if (actionId === 'clinic_reschedule_session_by_context') return 'clinic.session.rescheduled';
  if (actionId === 'clinic_register_attendance_by_phone_and_time') return 'clinic.session.completed';
  if (actionId === 'package_consume_unit_once') return 'clinic.package.unit_consumed';
  if (actionId === 'clinic_add_evolution_to_existing_attendance') return 'clinic.evolution.created';
  if (actionId === 'clinic_get_patient_full_snapshot') return 'clinic.snapshot.generated';
  return 'clinic.action.executed';
}

function extractClinicLogFields(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const obj = payload as Record<string, unknown>;
  const write = obj.write && typeof obj.write === 'object' ? (obj.write as Record<string, unknown>) : {};
  const verification =
    obj.verification && typeof obj.verification === 'object' ? (obj.verification as Record<string, unknown>) : {};
  const snapshot =
    verification.snapshot && typeof verification.snapshot === 'object'
      ? (verification.snapshot as Record<string, unknown>)
      : {};
  return {
    partyId: write.partyId ?? snapshot.partyId,
    careSubjectId: write.careSubjectId ?? snapshot.careSubjectId,
    appointmentId: write.appointmentId ?? snapshot.appointmentId,
    encounterId: write.encounterId ?? snapshot.encounterId,
    packageSaleId: write.packageSaleId ?? snapshot.packageSaleId,
  };
}

function isRetrySafeActionId(actionId: string): boolean {
  if (actionId === 'business.ping') return true;
  return /(_find_|_list_|_get_|_summary|_top_|_total_|_balance)/.test(actionId);
}

function isTransientExecutionError(message: string): boolean {
  return RETRYABLE_EXECUTION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function classifyExecutionError(message: string): 'TOOL_UNAVAILABLE' | 'BUSINESS_RULE' | 'INTERNAL_ERROR' {
  if (isTransientExecutionError(message)) return 'TOOL_UNAVAILABLE';
  if (/(obrigatorio|invalido|deve|nao encontrado|sem saldo|pertencer)/i.test(message)) return 'BUSINESS_RULE';
  return 'INTERNAL_ERROR';
}

export interface IBusinessToolRuntime {
  execute(params: {
    workspaceId: string;
    toolDefinitionId: string;
    actionId: string;
    input: unknown;
    correlationId?: string;
    teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
    conversationId?: string;
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
    teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
    conversationId?: string;
  }): Promise<{ ok: boolean; result?: unknown; error?: string; errorCode?: string }> {
    const actionId = params.actionId.trim();
    const rawInput = params.input;
    const normalizedInput = normalizeBusinessActionInput(actionId, rawInput);
    const emitClinicLog = (status: 'success' | 'error' | 'verification_failed', detail?: Record<string, unknown>) => {
      if (!actionId.startsWith('clinic_')) return;
      recordClinicActionMetrics({ action: actionId, status });
      const domainEvent = mapClinicDomainEvent(actionId, status);
      logger.info(
        {
          kind: 'clinic_action_runtime',
          event: domainEvent,
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          correlationId: params.correlationId,
          teamId: params.teamContext?.teamId,
          action: actionId,
          verificationStatus: status,
          ...detail,
        },
        'clinic_action_runtime',
      );
    };
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
      emitClinicLog('error', { errorCode: 'UNKNOWN_ACTION' });
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
      emitClinicLog('error', { errorCode: 'MISSING_REQUIRED_FIELDS', missingFields: missing });
      return {
        ok: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        error: `Campos obrigatorios em falta: ${missing.join(', ')}`,
        result: { missingFields: missing, submittedInput: normalizedInput },
      };
    }

    for (let attempt = 0; attempt <= MAX_SAFE_EXECUTION_RETRIES; attempt++) {
      try {
        const rawResult = await handler({
          workspaceId: params.workspaceId,
          input: normalizedInput,
          correlationId: params.correlationId,
          teamContext: params.teamContext,
          conversationId: params.conversationId,
        });
        const coerced = (() => {
          if (!actionId.startsWith('clinic_')) return { ok: true as const, result: rawResult };
          const obj =
            rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
              ? (rawResult as Record<string, unknown>)
              : null;
          const verification = obj && typeof obj.verification === 'object' && obj.verification !== null
            ? (obj.verification as Record<string, unknown>)
            : null;
          const matches = verification ? verification.matches : undefined;
          const found = verification ? verification.found : undefined;
          if (matches === false || found === false) {
            return { ok: false as const, result: rawResult, errorCode: 'CLINIC_VERIFICATION_FAILED' as const };
          }
          return { ok: true as const, result: rawResult };
        })();
        await this.auditRepo.append({
          workspaceId: params.workspaceId,
          toolDefinitionId: params.toolDefinitionId,
          actionId,
          ok: coerced.ok,
          ...(coerced.ok ? {} : { errorCode: coerced.errorCode }),
          rawInput,
          normalizedInput,
          submittedInput: normalizedInput,
          validationResult: { ok: true },
          result: coerced.result,
          correlationId: params.correlationId,
        });
        if (coerced.ok) {
          emitClinicLog('success', extractClinicLogFields(coerced.result));
          return { ok: true, result: coerced.result };
        }
        emitClinicLog('verification_failed', {
          errorCode: coerced.errorCode,
          ...extractClinicLogFields(coerced.result),
        });
        return {
          ok: false,
          error: 'Falha ao confirmar persistência (read-after-write) para ação clínica.',
          errorCode: coerced.errorCode,
          result: coerced.result,
        };
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
          emitClinicLog('error', { errorCode: 'EXECUTION_RETRY', retry: retryMeta });
          continue;
        }

        const errorType = classifyExecutionError(msg);
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
          result: { message: msg, submittedInput: normalizedInput, retry: retryMeta, errorType },
          correlationId: params.correlationId,
        });
        emitClinicLog('error', { errorCode: 'EXECUTION_ERROR', errorType, retry: retryMeta });
        return {
          ok: false,
          error: msg,
          errorCode: 'EXECUTION_ERROR',
          result: { submittedInput: normalizedInput, retry: retryMeta, errorType },
        };
      }
    }
    return { ok: false, error: 'Falha inesperada no boundary de execução.', errorCode: 'EXECUTION_ERROR' };
  }
}
