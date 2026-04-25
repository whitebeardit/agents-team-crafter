import { Types } from 'mongoose';
import { importTeamFromExport } from '../../teams/application/import-team-from-export.js';
import type { teamImportBodySchema } from '../../teams/application/import-team-from-export.js';
import { TemplateModel } from '../infra/template.model.js';
import type { TemplateDoc } from '../infra/template.model.js';
import { TemplateRepository } from '../infra/template.repository.js';
import type { IAppDeps } from '../../../config/container.js';
import type { TTeamTemplateExportPayload } from './sanitize-template-export.js';
import type { z } from 'zod';

type TApplyInput = {
  teamName: string;
  teamDescription?: string;
  mcpConnectionIdMap?: Record<string, string>;
  channelSecretPayloads?: Record<string, unknown>;
};

function buildTemplateIdQuery(workspaceId: string, templateId: string) {
  return {
    _id: new Types.ObjectId(templateId),
    $or: [
      { workspaceId: new Types.ObjectId(workspaceId) },
      { templateScope: 'global' as const, origin: 'whitebeard' as const },
    ],
  };
}

type TApplyResult = {
  teamId: string;
  name: string;
  status: string;
  message: string;
};

/**
 * Aplica template: usa `importTeamFromExport` com `templatePayload` (ou fallback legado sem full payload).
 * Devolve `null` se o template nao existir.
 */
export async function applyTemplateWithImport(
  deps: IAppDeps,
  templateRepo: TemplateRepository,
  workspaceId: string,
  templateId: string,
  input: TApplyInput,
): Promise<
  | { result: TApplyResult; importWarnings: string[]; importMode: 'import' | 'legacy' }
  | null
> {
  const doc = (await TemplateModel.findOne(buildTemplateIdQuery(workspaceId, templateId))
    .lean()
    .exec()) as (TemplateDoc & { templatePayload?: TTeamTemplateExportPayload }) | null;
  if (!doc) {
    return null;
  }

  if (doc.templatePayload) {
    const fullPayload = doc.templatePayload;
    const team = { ...(fullPayload.team as Record<string, unknown>) };
    team['name'] = input.teamName;
    if (input.teamDescription != null) team['description'] = input.teamDescription;

    const importPayload: Record<string, unknown> = {
      ...fullPayload,
      team,
      exportKind: 'template',
    };

    const wId = (doc as { workspaceId: Types.ObjectId }).workspaceId;
    const sameWorkspaceMcp = Boolean(
      wId && String(wId) === String(workspaceId) && doc['templateScope'] !== 'global',
    );

    const importBody: z.infer<typeof teamImportBodySchema> = {
      payload: importPayload,
      mcpConnectionIdMap: input.mcpConnectionIdMap,
      channelSecretPayloads: input.channelSecretPayloads,
      forceCreate: true,
      retireReplacedAgents: true,
    };

    const out = await importTeamFromExport(deps, workspaceId, {
      mode: 'create',
      importBody,
      sameWorkspaceMcp: Boolean(sameWorkspaceMcp),
    });

    const teamRow = await deps.teamRepo.findById(workspaceId, out.teamId);
    const tname = (teamRow as { name?: string } | null)?.name ?? input.teamName;

    return {
      result: {
        teamId: out.teamId,
        name: tname,
        status: (teamRow as { status?: string } | null)?.status ?? 'draft',
        message: 'Time criado a partir do template (import unificado)',
      },
      importWarnings: out.warnings,
      importMode: 'import',
    };
  }

  const legacy = await templateRepo.applyLegacy(workspaceId, templateId, {
    teamName: input.teamName,
    teamDescription: input.teamDescription,
  });
  if (!legacy) {
    return null;
  }
  return { result: legacy, importWarnings: [], importMode: 'legacy' };
}
