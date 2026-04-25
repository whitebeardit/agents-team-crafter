import { buildTeamExportPayload, type TTeamExportDeps } from '../../teams/application/build-team-export.js';
import { sanitizeTeamExportToTemplate, type TTeamTemplateExportPayload } from './sanitize-template-export.js';

/**
 * Gera o payload de template a partir de um time + saneamento. Usado em POST /templates e promover admin.
 */
export async function buildSanitizedTemplatePayload(
  teamExportDeps: TTeamExportDeps,
  workspaceId: string,
  teamId: string,
  opts: { includeSourceTeamId: boolean },
): Promise<TTeamTemplateExportPayload> {
  const full = await buildTeamExportPayload(teamExportDeps, workspaceId, teamId);
  return sanitizeTeamExportToTemplate(full, { includeSourceTeamId: opts.includeSourceTeamId, sourceTeamId: teamId });
}
