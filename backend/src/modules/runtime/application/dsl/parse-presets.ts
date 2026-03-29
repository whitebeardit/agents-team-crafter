import { AppError } from '../../../../shared/errors/app-error.js';
import type { TDslRule } from './ast.js';

export function parseDslPresets(rules: string[] | undefined): TDslRule[] {
  if (!rules || rules.length === 0) return [];
  const out: TDslRule[] = [];

  for (const raw of rules) {
    const s = String(raw).trim();
    if (!s) continue;

    if (s.startsWith('guard:')) {
      const [, key, value] = s.split(':');
      if (!key) throw new AppError('VALIDATION_ERROR', `DSL guard invalido: ${s}`, 400);
      if (key === 'maxDepth') {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) throw new AppError('VALIDATION_ERROR', `maxDepth invalido: ${s}`, 400);
        out.push({ kind: 'guard', maxDepth: n });
        continue;
      }
      if (key === 'noRepeat') {
        if (value !== 'true' && value !== 'false') {
          throw new AppError('VALIDATION_ERROR', `noRepeat invalido: ${s}`, 400);
        }
        out.push({ kind: 'guard', noRepeat: value === 'true' });
        continue;
      }
      if (key === 'timeoutMs') {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) throw new AppError('VALIDATION_ERROR', `timeoutMs invalido: ${s}`, 400);
        out.push({ kind: 'guard', timeoutMs: n });
        continue;
      }
      throw new AppError('VALIDATION_ERROR', `guard desconhecido: ${s}`, 400);
    }

    if (s.startsWith('route:taskType:')) {
      const [left, right] = s.split('->');
      const taskType = left.replace('route:taskType:', '').trim();
      const [agentKey, agentId] = (right ?? '').split(':');
      if (!taskType || agentKey !== 'agent' || !agentId) {
        throw new AppError('VALIDATION_ERROR', `route taskType invalida: ${s}`, 400);
      }
      out.push({ kind: 'route_taskType', taskType, targetAgentId: agentId.trim() });
      continue;
    }

    if (s.startsWith('route:toolError:')) {
      const [left, right] = s.split('->');
      const toolName = left.replace('route:toolError:', '').trim();
      if (!toolName || !right) throw new AppError('VALIDATION_ERROR', `route toolError invalida: ${s}`, 400);

      // Formas suportadas:
      // - agent:<agentId>
      // - capability:<capabilityId>:fallback:<agentId>
      const parts = right.split(':').map((x) => x.trim());
      if (parts[0] === 'agent' && parts[1]) {
        out.push({ kind: 'route_toolError', toolName, targetAgentId: parts[1] });
        continue;
      }
      if (parts[0] === 'capability' && parts[1] && parts[2] === 'fallback' && parts[3]) {
        out.push({
          kind: 'route_toolError',
          toolName,
          capabilityId: parts[1],
          fallbackAgentId: parts[3],
        });
        continue;
      }
      throw new AppError('VALIDATION_ERROR', `route toolError invalida: ${s}`, 400);
    }

    throw new AppError('VALIDATION_ERROR', `DSL rule desconhecida: ${s}`, 400);
  }

  return out;
}

