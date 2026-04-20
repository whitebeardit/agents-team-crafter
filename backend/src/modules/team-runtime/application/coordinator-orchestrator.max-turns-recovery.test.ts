import { describe, expect, it, jest } from '@jest/globals';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';

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
    const workspaceIntegrationsService = {
      resolveOpenAiApiKey: jest.fn(async () => 'fake-key'),
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
});
