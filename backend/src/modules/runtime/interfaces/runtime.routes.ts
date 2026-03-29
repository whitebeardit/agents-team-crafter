import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { agentRunBodySchema, executeAgentRun } from '../application/agent-runtime-run.service.js';

export async function registerRuntimeRoutes(app: FastifyInstance, d: IAppDeps) {
  const tenant = [d.authenticate, d.requireTenant];

  app.post('/agents/:id/run', { preHandler: tenant }, async (req, reply) => {
    const ws = req.workspaceId!;
    const agentId = (req.params as { id: string }).id;
    const body = agentRunBodySchema.parse(req.body);
    const result = await executeAgentRun(d, { workspaceId: ws, agentId, body });
    return reply.send(
      successEnvelope({
        runId: result.runId,
        agentId: result.agentId,
        selectedAgentId: result.selectedAgentId,
        decision: result.decision,
        handoffs: result.handoffs,
        orchestrationDepth: result.orchestrationDepth,
        output: result.output,
        events: result.events,
      }),
    );
  });
}

