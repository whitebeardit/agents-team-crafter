import { describe, expect, it, jest } from '@jest/globals';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';

describe('CoordinatorOrchestratorService interruption guards (Loop 139A)', () => {
  function buildServiceWithCoordinatorEvents(
    events: Array<{ type: 'toolResult'; tool: string; status: 'error'; errorCode?: string; detail?: string }>,
  ) {
    const teamRepo = {
      findById: jest.fn(async () => ({
        id: 'team-1',
        coordinatorId: 'coord-1',
        agentIds: [],
        name: 'Time',
      })),
    };
    const agentRepo = {
      findById: jest.fn(async () => ({
        id: 'coord-1',
        role: 'coordinator',
        capabilities: {},
        systemInstruction: 'coord',
      })),
    };
    const agentRuntime = {
      runCoordinatorTurn: jest.fn(async () => ({
        finalOutput: 'resultado parcial sem conclusão',
        events,
      })),
    };
    const specialistRegistry = { buildOpenAiTools: jest.fn(() => []) };
    const workspaceIntegrationsService = {
      resolveOpenAiApiKey: jest.fn(async () => 'fake-key'),
      resolveLlmProviderConfig: jest.fn(async () => ({ provider: 'openai', apiKey: 'fake-key', baseUrl: 'https://api.openai.com/v1', useResponses: true })),
      getToolIntegrationContext: jest.fn(async () => ({ resolver: async () => ({ status: 'missing' }) })),
      resolveAgentsRuntimeModel: jest.fn(async () => 'gpt-5.4-mini'),
    };
    const businessToolRuntime = {
      execute: jest.fn(async () => ({ ok: false, errorCode: 'EXECUTION_ERROR', error: 'unavailable' })),
    };

    return new CoordinatorOrchestratorService(
      agentRepo as never,
      teamRepo as never,
      agentRuntime as never,
      specialistRegistry as never,
      workspaceIntegrationsService as never,
      { listByAgent: jest.fn(async () => []) } as never,
      { findById: jest.fn(async () => null) } as never,
      { listByIds: jest.fn(async () => []) } as never,
      { listByIds: jest.fn(async () => []) } as never,
      businessToolRuntime as never,
      { get: jest.fn(async () => null), upsert: jest.fn(async () => {}) } as never,
    );
  }

  it('interrupts with MISSING_REQUIRED_FIELDS_REPEATED when same required-fields failure repeats', async () => {
    const service = buildServiceWithCoordinatorEvents([
      {
        type: 'toolResult',
        tool: 'ws_crm_upsert',
        status: 'error',
        errorCode: 'MISSING_REQUIRED_FIELDS',
        detail: 'displayName é obrigatório',
      },
      {
        type: 'toolResult',
        tool: 'ws_crm_upsert',
        status: 'error',
        errorCode: 'MISSING_REQUIRED_FIELDS',
        detail: 'displayName é obrigatório',
      },
    ]);

    const out = await service.execute({
      trigger: 'manual',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      coordinatorId: 'coord-1',
      message: 'cadastre cliente novo',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
    });

    expect(out.externalResponse.text).toMatch(/Execução interrompida/i);
    const interrupted = out.events.find((e) => e.type === 'executionInterrupted');
    expect(interrupted?.interruptReasonCode).toBe('MISSING_REQUIRED_FIELDS_REPEATED');
    expect(interrupted?.interruptTool).toBe('ws_crm_upsert');
    expect(interrupted?.interruptPolicy).toBe('REPEATED_TOOL_FAILURE_GUARD');
    expect(interrupted?.progressState).toBe('missing_fields_repeated');
  });

  it('interrupts with NO_PROGRESS_DETECTED when same generic tool failure repeats', async () => {
    const service = buildServiceWithCoordinatorEvents([
      {
        type: 'toolResult',
        tool: 'ws_crm_upsert',
        status: 'error',
        errorCode: 'EXECUTION_ERROR',
        detail: 'timeout',
      },
      {
        type: 'toolResult',
        tool: 'ws_crm_upsert',
        status: 'error',
        errorCode: 'EXECUTION_ERROR',
        detail: 'timeout',
      },
    ]);

    const out = await service.execute({
      trigger: 'manual',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      coordinatorId: 'coord-1',
      message: 'cadastre cliente novo',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
    });

    expect(out.externalResponse.text).toMatch(/Execução interrompida/i);
    const interrupted = out.events.find((e) => e.type === 'executionInterrupted');
    expect(interrupted?.interruptReasonCode).toBe('NO_PROGRESS_DETECTED');
    expect(interrupted?.interruptTool).toBe('ws_crm_upsert');
    expect(interrupted?.interruptPolicy).toBe('NO_PROGRESS_GUARD');
    expect(interrupted?.progressState).toBe('tool_error_repeated');
  });
});
