import { describe, expect, it, jest } from '@jest/globals';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';

describe('CoordinatorOrchestratorService specialist technical timeline', () => {
  it('includes specialist runtime events with caller, input and output in the final timeline', async () => {
    let executeSpecialist:
      | ((specialistAgentId: string, instruction: string) => Promise<string>)
      | undefined;

    const teamRepo = {
      findById: jest.fn(async () => ({
        id: 'team-1',
        coordinatorId: 'coord-1',
        agentIds: ['coord-1', 'spec-1'],
        name: 'Time',
      })),
    };
    const agentRepo = {
      findById: jest.fn(async (_ws: string, id: string) => {
        if (id === 'coord-1') {
          return {
            id: 'coord-1',
            role: 'coordinator',
            capabilities: {},
            systemInstruction: 'coord',
          };
        }
        if (id === 'spec-1') {
          return {
            id: 'spec-1',
            role: 'assistant',
            name: 'Especialista CRM',
            description: 'Especialista',
            systemInstruction: 'spec',
            capabilities: { tools: ['crm'] },
            knowledge: { sources: [] },
            security: { accessLevel: 'write' },
          };
        }
        return null;
      }),
    };
    const agentRuntime = {
      compile: jest.fn(async () => ({ ok: true })),
      runStep: jest.fn(async () => ({
        finalOutput: 'Cliente criado.',
        events: [
          {
            type: 'toolCall',
            tool: 'ws_crm_create_party',
            callId: 'call-1',
            toolInput: '{}',
          },
          {
            type: 'toolResult',
            tool: 'ws_crm_create_party',
            callId: 'call-1',
            toolOutput: '{"ok":false,"errorCode":"MISSING_REQUIRED_FIELDS"}',
            status: 'error',
            errorCode: 'MISSING_REQUIRED_FIELDS',
            detail: 'name é obrigatório',
          },
        ],
      })),
      runCoordinatorTurn: jest.fn(async () => {
        if (!executeSpecialist) throw new Error('executeSpecialist não capturado');
        await executeSpecialist('spec-1', 'Criar cliente no CRM com os dados recebidos.');
        return {
          finalOutput: 'Pedido encaminhado.',
          events: [],
        };
      }),
    };
    const specialistRegistry = {
      buildOpenAiTools: jest.fn((args: { executeSpecialist: typeof executeSpecialist }) => {
        executeSpecialist = args.executeSpecialist;
        return [];
      }),
    };
    const workspaceIntegrationsService = {
      resolveOpenAiApiKey: jest.fn(async () => 'fake-key'),
      getToolIntegrationContext: jest.fn(async () => ({ resolver: async () => ({ status: 'missing' }) })),
    };
    const businessToolRuntime = {
      execute: jest.fn(async () => ({ ok: false, errorCode: 'EXECUTION_ERROR', error: 'unused' })),
    };

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
      message: 'cadastre a Ada Lovelace',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
      conversation: {
        id: 'conv-1',
        history: [{ role: 'user', content: 'cadastre a Ada Lovelace' }],
      },
    });

    const specialistStarted = out.events.find((event) => event.type === 'specialistStarted');
    const toolCall = out.events.find((event) => event.type === 'toolCall');
    const toolResult = out.events.find((event) => event.type === 'toolResult');
    const specialistFinished = out.events.find((event) => event.type === 'specialistFinished');

    expect(specialistStarted?.agentId).toBe('spec-1');
    expect(specialistStarted?.invokedByAgentId).toBe('spec-1');
    expect(toolCall).toMatchObject({
      type: 'toolCall',
      tool: 'ws_crm_create_party',
      callId: 'call-1',
      toolInput: '{}',
      invokedByAgentId: 'spec-1',
    });
    expect(toolResult).toMatchObject({
      type: 'toolResult',
      tool: 'ws_crm_create_party',
      callId: 'call-1',
      toolOutput: '{"ok":false,"errorCode":"MISSING_REQUIRED_FIELDS"}',
      status: 'error',
      errorCode: 'MISSING_REQUIRED_FIELDS',
      detail: 'name é obrigatório',
      invokedByAgentId: 'spec-1',
    });
    expect(specialistFinished?.agentId).toBe('spec-1');
    expect(out.events.some((event) => event.type === 'coordinatorFinished')).toBe(true);
  });
});
