import { describe, expect, it, jest } from '@jest/globals';
import { CoordinatorOrchestratorService } from './coordinator-orchestrator.service.js';
import {
  testEnvStub,
  secondBrainDepsStub,
  commonWorkspaceIntegrationsMock,
} from './coordinator-orchestrator-test-utils.js';

describe('CoordinatorOrchestratorService image handoff between specialists', () => {
  it('propagates generated image URL to next specialist as input_image content part', async () => {
    const teamRepo = {
      findById: jest.fn(async () => ({
        id: 'team-1',
        coordinatorId: 'coord-1',
        agentIds: ['spec-image', 'spec-review'],
        name: 'Time Kids',
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
        if (id === 'spec-image') {
          return {
            id: 'spec-image',
            role: 'specialist',
            name: 'Pincel',
            description: 'Gera imagem',
            category: 'imagem',
            capabilities: { tools: [] },
            security: { accessLevel: 'read' },
          };
        }
        if (id === 'spec-review') {
          return {
            id: 'spec-review',
            role: 'specialist',
            name: 'Revisor',
            description: 'Revisa imagem',
            category: 'revisao',
            capabilities: { tools: [] },
            security: { accessLevel: 'read' },
          };
        }
        return null;
      }),
    };

    const seenInputs: Array<{ contentParts?: Array<{ type: string; imageUrl?: string }> }> = [];
    const runStep = jest.fn(async (_config: unknown, input: { contentParts?: Array<{ type: string; imageUrl?: string }> }) => {
      seenInputs.push(input);
      if (seenInputs.length === 1) {
        return {
          finalOutput: 'Imagem gerada: ![Imagem gerada](https://cdn.example.com/generated.png)',
          events: [],
        };
      }
      return {
        finalOutput: '{"status":"APROVADO"}',
        events: [],
      };
    });

    const agentRuntime = {
      compile: jest.fn(async () => ({ ok: true })),
      runStep,
      runCoordinatorTurn: jest.fn(async ({ sdkTools }: { sdkTools: unknown[] }) => {
        async function runTool(tool: unknown, instruction: string): Promise<void> {
          const t = tool as {
            invoke?: (json: string) => Promise<string>;
            execute?: (args: { instruction: string }) => Promise<string>;
          };
          if (typeof t.execute === 'function') {
            await t.execute({ instruction });
            return;
          }
          if (typeof t.invoke === 'function') {
            await t.invoke(JSON.stringify({ instruction }));
            return;
          }
          throw new Error('mock tool missing execute/invoke');
        }
        // second_brain_* tools prefix specialist tools from SpecialistRegistry
        await runTool(sdkTools[2], 'gere a ilustracao');
        await runTool(sdkTools[3], 'revise a ilustracao gerada');
        return { finalOutput: 'Fluxo concluido', events: [] };
      }),
    };

    const specialistRegistry = {
      buildOpenAiTools: jest.fn(({ specialists, executeSpecialist }) =>
        specialists.map((s: { id: string }) => ({
          execute: ({ instruction }: { instruction: string }) => executeSpecialist(s.id, instruction),
        })),
      ),
    };
    const sb = secondBrainDepsStub();
    const workspaceIntegrationsService = {
      ...commonWorkspaceIntegrationsMock(),
      getToolIntegrationContext: jest.fn(async () => ({})),
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
      { execute: jest.fn(async () => ({ ok: false })) } as never,
      { get: jest.fn(async () => null), upsert: jest.fn(async () => {}) } as never,
      sb.vaultWriter as never,
      sb.vaultNoteIndexRepo as never,
      sb.secondBrainRecall as never,
      sb.secondBrainCurator as never,
    );

    await service.execute({
      trigger: 'manual',
      workspaceId: 'ws-1',
      teamId: 'team-1',
      coordinatorId: 'coord-1',
      message: 'Crie uma questão com imagem e revise',
      coordinatorExternalContext: {},
      metadata: { correlationId: 'corr-1' },
    });

    expect(runStep).toHaveBeenCalledTimes(2);
    const secondRunInput = seenInputs[1];
    expect(secondRunInput.contentParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'input_image',
          imageUrl: 'https://cdn.example.com/generated.png',
        }),
      ]),
    );
  });
});
