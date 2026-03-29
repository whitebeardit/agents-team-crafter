import { AppError } from '../../../shared/errors/app-error.js';
import type { TDslRule } from './dsl/ast.js';

export interface IHandoffPolicyInput {
  workspaceId: string;
  currentAgentId: string;
  depth: number;
  visitedAgentIds: string[];
  canDelegate: boolean;
  handoffTargets: string[];
  taskType?: string;
  rules: TDslRule[];
}

export type TPolicyDecision =
  | { kind: 'continue' }
  | { kind: 'handoff'; nextAgentId: string; reason: string };

export function decideHandoff(input: IHandoffPolicyInput): TPolicyDecision {
  const guards = input.rules.filter((r) => r.kind === 'guard') as Array<Extract<TDslRule, { kind: 'guard' }>>;
  const maxDepth = guards.map((g) => g.maxDepth).find((v) => v !== undefined);
  const noRepeat = guards.map((g) => g.noRepeat).find((v) => v !== undefined);

  if (maxDepth !== undefined && input.depth > maxDepth) {
    throw new AppError('HANDOFF_BLOCKED', 'Handoff bloqueado: maxDepth excedido', 400, {
      maxDepth,
      depth: input.depth,
    });
  }

  if (!input.canDelegate) return { kind: 'continue' };
  if (!input.taskType) return { kind: 'continue' };

  const routeRules = input.rules.filter((r) => r.kind === 'route_taskType') as Array<
    Extract<TDslRule, { kind: 'route_taskType' }>
  >;
  const match = routeRules.find((r) => r.taskType === input.taskType);
  if (!match) return { kind: 'continue' };

  if (!input.handoffTargets.includes(match.targetAgentId)) {
    throw new AppError('HANDOFF_BLOCKED', 'Handoff bloqueado: target nao permitido', 400, {
      targetAgentId: match.targetAgentId,
    });
  }

  if (noRepeat && input.visitedAgentIds.includes(match.targetAgentId)) {
    throw new AppError('HANDOFF_BLOCKED', 'Handoff bloqueado: loop detectado', 400, {
      targetAgentId: match.targetAgentId,
      visitedAgentIds: input.visitedAgentIds,
    });
  }

  return { kind: 'handoff', nextAgentId: match.targetAgentId, reason: `route:taskType:${input.taskType}` };
}

