import { AppError } from '../../../shared/errors/app-error.js';

/**
 * Loop 86 — no mesmo team plan, cada especialista deve ser dono de um workflow/domínio distinto
 * (`workflowKey`, comparação case-insensitive). Coordenador ignorado.
 */
export interface IPlannerWorkflowConflict {
  workflowKey: string;
  specialistNames: string[];
}

export function getSpecialistWorkflowConflicts(
  agents: ReadonlyArray<{ role: string; name: string; workflowKey?: string }>,
): IPlannerWorkflowConflict[] {
  const specialists = agents.filter((a) => a.role === 'specialist');
  const keyLowerToEntry = new Map<string, { displayKey: string; names: string[] }>();
  for (const ag of specialists) {
    const raw = (ag.workflowKey ?? '').trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    const entry = keyLowerToEntry.get(lower) ?? { displayKey: raw, names: [] };
    entry.names.push(ag.name);
    if (!entry.displayKey) entry.displayKey = raw;
    keyLowerToEntry.set(lower, entry);
  }
  const out: IPlannerWorkflowConflict[] = [];
  for (const { displayKey, names } of keyLowerToEntry.values()) {
    if (names.length > 1) {
      out.push({ workflowKey: displayKey, specialistNames: names });
    }
  }
  return out;
}

export function formatWorkflowConflictsForMessage(conflicts: readonly IPlannerWorkflowConflict[]): string {
  return conflicts.map((c) => `${c.workflowKey} (${c.specialistNames.join(' e ')})`).join('; ');
}

/**
 * @throws AppError VALIDATION_ERROR 400
 */
export function assertSpecialistWorkflowOwnership(
  agents: ReadonlyArray<{ role: string; name: string; workflowKey?: string }>,
): void {
  const conflicts = getSpecialistWorkflowConflicts(agents);
  if (conflicts.length === 0) return;
  throw new AppError(
    'VALIDATION_ERROR',
    `Cada especialista deve ser dono de um workflow distinto no mesmo plano. Conflitos: ${formatWorkflowConflictsForMessage(conflicts)}. Ajuste workflowKey ou una os papeis.`,
    400,
  );
}
