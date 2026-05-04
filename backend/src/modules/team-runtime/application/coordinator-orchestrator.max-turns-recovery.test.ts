import { describe, expect, it, jest } from '@jest/globals';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';
import {
  testEnvStub,
  secondBrainDepsStub,
  commonWorkspaceIntegrationsMock,
} from './coordinator-orchestrator-test-utils.js';

describe('CoordinatorOrchestratorService max-turns CRM recovery (Loop 138)', () => {
  it('recovers with deterministic CRM read when preflight fails and coordinator returns max turns', async () => {
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
        finalOutput: 'Erro ao executar coordenador: Max turns (10) exceeded',
        events: [],
      })),
    };
    const specialistRegistry = { buildOpenAiTools: jest.fn(() => []) };
    const sb = secondBrainDepsStub();
    const workspaceIntegrationsService = {
      ...commonWorkspaceIntegrationsMock(),
      getToolIntegrationContext: jest.fn(async () => ({ resolver: async () => ({ status: 'missing' }) })),
    };
    const execute = jest.fn<() => Promise<{ ok: boolean; result?: unknown; errorCode?: string; error?: string }>>();
    // preflight attempt fails; runtime proceeds to coordinator
    execute.mockResolvedValueOnce({ ok: false, errorCode: 'EXECUTION_ERROR', error: 'temporary' });
    // recovery attempt succeeds after max-turns output
    execute.mockResolvedValueOnce({
      ok: true,
      result: {
        parties: [{ id: 'p-1', displayName: 'Cliente Recovery', email: 'recovery@empresa.test' }],
      },
    });
    const businessToolRuntime = { execute };

    const service = new CoordinatorOrchestratorService(
      testEnvStub(),
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
      sb.vaultWriter as never,
      sb.vaultNoteIndexRepo as never,
      sb.secondBrainRecall as never,
      sb.secondBrainCurator as never,
    );

    const out = await service.execute({
      trigger: 'manual',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      coordinatorId: 'coord-1',
      message: 'liste todos os clientes cadastrados',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
    });

    expect(businessToolRuntime.execute).toHaveBeenCalledTimes(2);
    expect(agentRuntime.runCoordinatorTurn).toHaveBeenCalledTimes(1);
    expect(out.externalResponse.text).toContain('Cliente Recovery');
    expect(out.events.some((e) => e.type === 'crmDirectReadRecoveryAfterMaxTurns')).toBe(true);
  });

  it('emits structured interruption when max turns is reached and deterministic recovery is unavailable', async () => {
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
        finalOutput: 'Erro ao executar coordenador: Max turns (10) exceeded',
        events: [],
      })),
    };
    const specialistRegistry = { buildOpenAiTools: jest.fn(() => []) };
    const sb2 = secondBrainDepsStub();
    const workspaceIntegrationsService = {
      ...commonWorkspaceIntegrationsMock(),
      getToolIntegrationContext: jest.fn(async () => ({ resolver: async () => ({ status: 'missing' }) })),
    };
    const businessToolRuntime = {
      execute: jest.fn(async () => ({ ok: false, errorCode: 'EXECUTION_ERROR', error: 'unavailable' })),
    };

    const service = new CoordinatorOrchestratorService(
      testEnvStub(),
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
      sb2.vaultWriter as never,
      sb2.vaultNoteIndexRepo as never,
      sb2.secondBrainRecall as never,
      sb2.secondBrainCurator as never,
    );

    const out = await service.execute({
      trigger: 'manual',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      coordinatorId: 'coord-1',
      message: 'liste todos os clientes cadastrados',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
    });

    expect(out.externalResponse.text).toMatch(/Execução interrompida/i);
    expect(out.externalResponse.text).toMatch(/Próximo passo sugerido/i);
    const interrupted = out.events.find((e) => e.type === 'executionInterrupted');
    expect(interrupted).toBeDefined();
    expect(interrupted?.interrupted).toBe(true);
    expect(interrupted?.interruptReasonCode).toBe('MAX_TURNS_REACHED');
    expect(interrupted?.interruptPolicy).toBe('MAX_TURNS_GUARD');
    expect(interrupted?.interruptStep).toBe('coordinator');
    expect(interrupted?.nextStep).toMatch(/pedido mais direto/i);
    const finished = out.events.find((e) => e.type === 'coordinatorFinished');
    expect(finished?.phase).toBe('interrupted');
    expect(out.events.some((e) => e.type === 'crmDirectReadRecoveryAfterMaxTurns')).toBe(false);
  });
});
