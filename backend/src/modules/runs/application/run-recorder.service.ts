import type { ITeamExecutionEvent, ITeamExecutionResult } from '../../team-runtime/domain/team-execution-result.js';
import { RunRepository } from '../infra/run.repository.js';
import type { TInterruptionReasonCode } from '../../team-runtime/domain/execution-interruption.js';

export type TRunCompletionStatus = 'completed' | 'failed' | 'interrupted' | 'cancelled';

function toStepType(event: ITeamExecutionEvent): string {
  if (event.type.startsWith('specialist')) return 'specialist';
  if (event.type.startsWith('coordinator')) return 'coordinator';
  if (event.type === 'toolCall' || event.type === 'toolResult') return 'tool';
  return event.type;
}

function toStepStatus(event: ITeamExecutionEvent): string {
  if (event.type.endsWith('Started')) return 'running';
  if (event.type.endsWith('Finished')) return 'completed';
  return event.status ?? 'completed';
}

function inferCompletionFromEvents(events: ITeamExecutionEvent[]): {
  status: TRunCompletionStatus;
  interruption?: {
    code?: TInterruptionReasonCode;
    message?: string;
    reasonDetail?: string;
    step?: string;
    tool?: string;
    policy?: string;
    progressState?: string;
    nextStep?: string;
  };
} {
  const cancelled = events.find((event) => event.type === 'runCancelled');
  if (cancelled) {
    return {
      status: 'cancelled',
      interruption: {
        code: cancelled.interruptReasonCode,
        message: cancelled.interruptReasonMessage ?? cancelled.detail,
        reasonDetail: cancelled.detail,
        step: cancelled.interruptStep,
        tool: cancelled.interruptTool,
        policy: cancelled.interruptPolicy,
        progressState: cancelled.progressState,
        nextStep: cancelled.nextStep,
      },
    };
  }
  const interrupted = events.find((event) => event.type === 'executionInterrupted' || event.interrupted === true);
  if (interrupted) {
    return {
      status: 'interrupted',
      interruption: {
        code: interrupted.interruptReasonCode,
        message: interrupted.interruptReasonMessage ?? interrupted.detail,
        reasonDetail: interrupted.detail,
        step: interrupted.interruptStep,
        tool: interrupted.interruptTool,
        policy: interrupted.interruptPolicy,
        progressState: interrupted.progressState,
        nextStep: interrupted.nextStep,
      },
    };
  }
  return { status: 'completed' };
}

export class RunRecorderService {
  constructor(private readonly repo: RunRepository) {}

  private buildSteps(events: ITeamExecutionEvent[], startedAt: Date, finishedAt: Date) {
    return events.map((event, index) => ({
      stepIndex: index + 1,
      stepType: toStepType(event),
      agentId: event.agentId,
      toolName: event.tool,
      status: toStepStatus(event),
      summary: event.detail ?? event.message ?? event.value ?? event.toolInstruction ?? event.type,
      startedAt,
      finishedAt,
    }));
  }

  private buildEvents(events: ITeamExecutionEvent[], startedAt: Date) {
    return events.map((event, index) => ({
      seq: index + 1,
      type: event.type,
      payload: event,
      createdAt: new Date(startedAt.getTime() + index),
    }));
  }

  async recordCompleted(input: {
    workspaceId: string;
    teamId: string;
    trigger: string;
    source: 'manual' | 'inbound' | 'planner';
    channel?: string;
    correlationId?: string;
    startedAt: Date;
    result: ITeamExecutionResult;
  }) {
    const finishedAt = new Date();
    const completion = inferCompletionFromEvents(input.result.events);
    const interruptMeta = completion.interruption
      ? {
          interrupted: true,
          interruptReasonCode: completion.interruption.code,
          interruptReasonMessage: completion.interruption.message,
          interruptReasonDetail: completion.interruption.reasonDetail,
          interruptStep: completion.interruption.step,
          interruptTool: completion.interruption.tool,
          interruptPolicy: completion.interruption.policy,
          progressState: completion.interruption.progressState,
          nextStep: completion.interruption.nextStep,
        }
      : null;
    await this.repo.upsertRun(input.workspaceId, input.result.runId, {
      teamId: input.teamId,
      coordinatorAgentId: input.result.coordinatorAgentId,
      trigger: input.trigger,
      source: input.source,
      channel: input.channel ?? 'debug',
      status: completion.status,
      correlationId: input.correlationId,
      startedAt: input.startedAt,
      finishedAt,
      externalResponse: input.result.externalResponse,
      error: null,
      interrupt: interruptMeta,
    });
    await this.repo.replaceSteps(input.workspaceId, input.result.runId, this.buildSteps(input.result.events, input.startedAt, finishedAt));
    await this.repo.replaceEvents(input.workspaceId, input.result.runId, this.buildEvents(input.result.events, input.startedAt));
  }

  async recordFailed(input: {
    workspaceId: string;
    teamId: string;
    runId: string;
    coordinatorAgentId: string;
    trigger: string;
    source: 'manual' | 'inbound' | 'planner';
    channel?: string;
    correlationId?: string;
    startedAt: Date;
    error: { code?: string; message: string; status?: number };
    events?: ITeamExecutionEvent[];
  }) {
    const finishedAt = new Date();
    await this.repo.upsertRun(input.workspaceId, input.runId, {
      teamId: input.teamId,
      coordinatorAgentId: input.coordinatorAgentId,
      trigger: input.trigger,
      source: input.source,
      channel: input.channel ?? 'debug',
      status: 'failed',
      correlationId: input.correlationId,
      startedAt: input.startedAt,
      finishedAt,
      externalResponse: null,
      error: input.error,
    });
    if (input.events) {
      await this.repo.replaceSteps(input.workspaceId, input.runId, this.buildSteps(input.events, input.startedAt, finishedAt));
      await this.repo.replaceEvents(input.workspaceId, input.runId, this.buildEvents(input.events, input.startedAt));
    }
  }
}
