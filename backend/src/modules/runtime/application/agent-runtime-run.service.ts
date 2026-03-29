import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { composeExecutableAgentConfig } from './compose-executable-config.js';
import { parseDslPresets } from './dsl/parse-presets.js';
import { parseDslJsonRules } from './dsl/parse-json.js';
import { decideHandoff } from './policy-engine.js';

export const agentRunBodySchema = z.object({
  message: z.string().min(1),
  channel: z.string().optional(),
  locale: z.string().optional(),
  requestedAccessLevel: z.enum(['read', 'write', 'restricted']).optional(),
  taskType: z.string().optional(),
});

export type IAgentRunBody = z.infer<typeof agentRunBodySchema>;

export type IAgentRunDecision =
  | { kind: 'continue' }
  | { kind: 'handoff'; nextAgentId: string; reason: string };

export interface IHandoffStep {
  fromAgentId: string;
  toAgentId: string;
  reason: string;
}

export interface IAgentRunExecutionResult {
  runId: string;
  agentId: string;
  selectedAgentId: string;
  decision: IAgentRunDecision;
  /** Handoffs aplicados em cadeia antes do runStep final (vazio = executou no agente inicial). */
  handoffs: IHandoffStep[];
  /** Numero de handoffs executados (0 = sem handoff). */
  orchestrationDepth: number;
  output: string;
  events: Array<{ type: string; value?: string; tool?: string; status?: string; errorCode?: string }>;
}

function loadAgentHandoffContext(agent: Record<string, unknown>) {
  const capabilities = (agent.capabilities as Record<string, unknown> | undefined) ?? {};
  const handoff = (agent.handoff as { targets?: string[]; rules?: unknown[] } | undefined) ?? {};
  const canDelegate = Boolean((capabilities as { canDelegate?: boolean }).canDelegate);
  const handoffTargets = handoff.targets ?? [];
  const rawRules = handoff.rules ?? [];
  const presetRules = parseDslPresets(rawRules.filter((r) => typeof r === 'string') as string[]);
  void parseDslJsonRules(rawRules.filter((r) => typeof r === 'object' && r !== null));
  return { canDelegate, handoffTargets, rules: presetRules };
}

/**
 * Executa runtime com handoff determinístico em cadeia (ate RUNTIME_MAX_HANDOFF_DEPTH) e um unico runStep no agente final.
 * Reutilizável por `POST /agents/:id/run` e por webhooks Chat SDK.
 */
export async function executeAgentRun(
  d: IAppDeps,
  params: { workspaceId: string; agentId: string; body: IAgentRunBody },
): Promise<IAgentRunExecutionResult> {
  const { workspaceId: ws, agentId, body } = params;
  const maxHandoffDepth = d.env.RUNTIME_MAX_HANDOFF_DEPTH;

  const handoffs: IHandoffStep[] = [];
  let currentAgentId = agentId;
  const visitedAgentIds: string[] = [agentId];
  let hopDepth = 0;

  while (true) {
    const agent = await d.agentRepo.findById(ws, currentAgentId);
    if (!agent) throw new AppError('NOT_FOUND', 'Agente nao encontrado', 404);

    const row = agent as Record<string, unknown>;
    const { canDelegate, handoffTargets, rules } = loadAgentHandoffContext(row);

    const decision = decideHandoff({
      workspaceId: ws,
      currentAgentId,
      depth: hopDepth,
      visitedAgentIds,
      canDelegate,
      handoffTargets,
      taskType: body.taskType,
      rules,
    });

    if (decision.kind === 'continue') {
      break;
    }

    if (hopDepth >= maxHandoffDepth) {
      throw new AppError(
        'HANDOFF_BLOCKED',
        'Handoff bloqueado: limite de orquestracao (RUNTIME_MAX_HANDOFF_DEPTH) atingido',
        400,
        { maxHandoffDepth, hopDepth },
      );
    }

    const selectedAgentId = decision.nextAgentId;
    const target = await d.agentRepo.findById(ws, selectedAgentId);
    if (!target) throw new AppError('HANDOFF_BLOCKED', 'Target de handoff nao encontrado', 400);
    const targetCaps = (target as { capabilities?: Record<string, unknown> }).capabilities ?? {};
    const canReceive = (targetCaps as { canReceiveHandoff?: boolean }).canReceiveHandoff;
    if (canReceive === false) {
      throw new AppError('HANDOFF_BLOCKED', 'Target nao pode receber handoff', 400, {
        targetAgentId: selectedAgentId,
      });
    }

    handoffs.push({
      fromAgentId: currentAgentId,
      toAgentId: selectedAgentId,
      reason: decision.reason,
    });
    visitedAgentIds.push(selectedAgentId);
    currentAgentId = selectedAgentId;
    hopDepth += 1;
  }

  const selectedAgent = await d.agentRepo.findById(ws, currentAgentId);
  if (!selectedAgent) throw new AppError('NOT_FOUND', 'Agente selecionado nao encontrado', 404);

  const finalDecision: IAgentRunDecision =
    handoffs.length > 0
      ? {
          kind: 'handoff',
          nextAgentId: currentAgentId,
          reason: handoffs[handoffs.length - 1]!.reason,
        }
      : { kind: 'continue' };

  const config = composeExecutableAgentConfig({
    agentId: currentAgentId,
    workspaceId: ws,
    systemInstruction: (selectedAgent as { systemInstruction?: string }).systemInstruction,
    tools: ((selectedAgent as { capabilities?: { tools?: string[] } }).capabilities?.tools ?? []) as string[],
    mcpBindingIds: [],
    knowledgeSourceIds: [],
    handoffTargets: [],
  });

  await d.agentRuntime.compile(config);
  const openaiApiKey = await d.workspaceIntegrationsService.resolveOpenAiApiKey(ws);
  const result = await d.agentRuntime.runStep(config, {
    message: body.message,
    channel: body.channel,
    locale: body.locale,
    requestedAccessLevel: body.requestedAccessLevel,
    taskType: body.taskType,
    ...(openaiApiKey ? { openaiApiKey } : {}),
    depth: hopDepth,
    visitedAgentIds,
  });

  const mergedEvents: IAgentRunExecutionResult['events'] = [
    ...handoffs.map((h) => ({
      type: 'handoff',
      value: `${h.fromAgentId}->${h.toAgentId}`,
      status: h.reason,
    })),
    ...result.events.map((e) => {
      if (e.type === 'taskType') return { type: e.type, value: e.value };
      if (e.type === 'toolResult') return { type: e.type, tool: e.tool, status: e.status, errorCode: e.errorCode };
      return {
        type: e.type,
        value: `${e.fromAgentId}->${e.toAgentId}`,
        status: e.reason,
      };
    }),
  ];

  const runId = randomUUID();
  return {
    runId,
    agentId,
    selectedAgentId: currentAgentId,
    decision: finalDecision,
    handoffs,
    orchestrationDepth: hopDepth,
    output: result.finalOutput,
    events: mergedEvents,
  };
}
