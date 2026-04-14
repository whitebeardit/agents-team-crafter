import { AppError } from '../../../shared/errors/app-error.js';

/**
 * IDs de `catalogTools` (catálogo OpenAI Agents SDK) cuja função primária liga-se a um
 * domínio de efeito/dados — no máximo **um especialista** por ID no mesmo plano.
 * Alinhado ao prompt do planner (Loop 77) e enforcement API (Loop 78).
 */
export const SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS = [
  'calendar_access',
  'internal_actions',
  'email_send',
  'image_generation',
  'file_search',
] as const;

export type TSpecialistExclusiveCatalogToolId = (typeof SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS)[number];

/** Colisão de um ID de catálogo exclusivo entre dois ou mais especialistas (Loop 80). */
export interface ISpecialistCatalogToolConflict {
  toolId: string;
  specialistNames: string[];
}

/**
 * Lista IDs exclusivos atribuídos a mais de um especialista (coordenador ignorado).
 * Usado pelo fluxo de auto-reparo do planner antes de `assertSpecialistsExclusiveCatalogTools`.
 */
export function getSpecialistsCatalogToolConflicts(
  agents: ReadonlyArray<{ role: string; name: string; catalogTools?: string[] }>,
): ISpecialistCatalogToolConflict[] {
  const exclusive = new Set<string>(SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS as unknown as string[]);
  const specialists = agents.filter((a) => a.role === 'specialist');
  const toolToNames = new Map<string, string[]>();
  for (const ag of specialists) {
    for (const tid of ag.catalogTools ?? []) {
      if (!exclusive.has(tid)) continue;
      const list = toolToNames.get(tid) ?? [];
      list.push(ag.name);
      toolToNames.set(tid, list);
    }
  }
  const out: ISpecialistCatalogToolConflict[] = [];
  for (const [toolId, names] of toolToNames.entries()) {
    if (names.length > 1) {
      out.push({ toolId, specialistNames: names });
    }
  }
  return out;
}

export function formatCatalogToolConflictsForMessage(conflicts: readonly ISpecialistCatalogToolConflict[]): string {
  return conflicts.map((c) => `${c.toolId} (${c.specialistNames.join(' e ')})`).join('; ');
}

/**
 * Garante que a interseção de `catalogTools` entre especialistas não contém IDs exclusivos
 * repetidos. O coordenador é ignorado.
 *
 * @throws AppError VALIDATION_ERROR 400
 */
export function assertSpecialistsExclusiveCatalogTools(
  agents: ReadonlyArray<{ role: string; name: string; catalogTools?: string[] }>,
): void {
  const conflicts = getSpecialistsCatalogToolConflicts(agents);
  if (conflicts.length === 0) return;
  throw new AppError(
    'VALIDATION_ERROR',
    `Ferramentas de catalogo de dominio nao podem repetir entre especialistas: ${formatCatalogToolConflictsForMessage(conflicts)}. Remova o ID duplicado de um dos especialistas ou una os papeis.`,
    400,
  );
}
