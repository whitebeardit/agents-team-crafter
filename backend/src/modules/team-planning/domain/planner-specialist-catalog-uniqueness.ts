import { AppError } from '../../../shared/errors/app-error.js';

/**
 * IDs de `catalogTools` (catálogo OpenAI Agents SDK) cuja função primária liga-se a um
 * domínio de efeito/dados — no máximo **um especialista** por ID no mesmo plano.
 * Alinhado ao prompt do planner (Loop 77) e enforcement API (Loop 78).
 */
export const SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS = [
  'database_query',
  'calendar_access',
  'internal_actions',
  'email_send',
  'image_generation',
  'file_search',
] as const;

export type TSpecialistExclusiveCatalogToolId = (typeof SPECIALIST_EXCLUSIVE_CATALOG_TOOL_IDS)[number];

/**
 * Garante que a interseção de `catalogTools` entre especialistas não contém IDs exclusivos
 * repetidos. O coordenador é ignorado.
 *
 * @throws AppError VALIDATION_ERROR 400
 */
export function assertSpecialistsExclusiveCatalogTools(
  agents: ReadonlyArray<{ role: string; name: string; catalogTools?: string[] }>,
): void {
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
  const parts: string[] = [];
  for (const [toolId, names] of toolToNames.entries()) {
    if (names.length > 1) {
      parts.push(`${toolId} (${names.join(' e ')})`);
    }
  }
  if (parts.length === 0) return;
  throw new AppError(
    'VALIDATION_ERROR',
    `Ferramentas de catalogo de dominio nao podem repetir entre especialistas: ${parts.join('; ')}. Remova o ID duplicado de um dos especialistas ou una os papeis.`,
    400,
  );
}
