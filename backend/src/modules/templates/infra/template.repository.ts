import { Types } from 'mongoose';
import { AgentModel } from '../../agents/infra/agent.model.js';
import type { AgentDoc } from '../../agents/infra/agent.model.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import type { TeamDoc } from '../../teams/infra/team.model.js';
import { TeamGraphModel } from '../../graphs/infra/team-graph.model.js';
import type { TeamGraphDoc } from '../../graphs/infra/team-graph.model.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { TemplateModel } from './template.model.js';
import type { TemplateDoc } from './template.model.js';
import type { TTeamTemplateExportPayload } from '../application/sanitize-template-export.js';
import { getCredentialSlotsForTemplate } from '../application/template-credential-slots.js';

function notDeleted() {
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

/** Catálogo do workspace + modelos whitebeard globais. */
export function templateListScopeOr(workspaceId: string) {
  return {
    $or: [
      { workspaceId: new Types.ObjectId(workspaceId) },
      { templateScope: 'global' as const, origin: 'whitebeard' as const },
    ],
  };
}

function toListItem(doc: TemplateDoc) {
  const tc = (doc.teamConfig as Record<string, unknown>) ?? {};
  const d = doc as TemplateDoc & {
    vertical?: string;
    prerequisites?: string[];
    applyBehavior?: string;
    validationSteps?: string[];
    goldenPrompts?: string[];
    expectedOutcome?: string;
  };
  const p = (doc as { templatePayload?: TTeamTemplateExportPayload }).templatePayload;
  return {
    id: doc._id.toString(),
    name: d.name,
    description: d.description,
    version: d.version,
    origin: d.origin,
    category: d.category,
    agentCount: d.agentCount,
    hasFullPayload: Boolean(p),
    templateScope: (d as { templateScope?: string }).templateScope ?? 'workspace',
    vertical: typeof d.vertical === 'string' ? d.vertical : '',
    prerequisites: Array.isArray(d.prerequisites) ? d.prerequisites : [],
    applyBehavior: typeof d.applyBehavior === 'string' ? d.applyBehavior : '',
    validationSteps: Array.isArray(d.validationSteps) ? d.validationSteps : [],
    goldenPrompts: Array.isArray(d.goldenPrompts) ? d.goldenPrompts : [],
    expectedOutcome: typeof d.expectedOutcome === 'string' ? d.expectedOutcome : '',
    teamConfig: {
      name: tc['name'] ?? d.name,
      description: tc['description'] ?? d.description,
    },
  };
}

export class TemplateRepository {
  async list(
    workspaceId: string,
    filters: { origin?: string; category?: string; search?: string },
  ) {
    const and: object[] = [templateListScopeOr(workspaceId)];
    if (filters.origin) and.push({ origin: filters.origin });
    if (filters.category) and.push({ category: filters.category });
    if (filters.search) {
      const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      and.push({ $or: [{ name: rx }, { description: rx }] });
    }
    const docs = await TemplateModel.find({ $and: and }).sort({ name: 1 }).exec();
    return docs.map((d) => toListItem(d as unknown as TemplateDoc));
  }

  async findById(workspaceId: string, id: string) {
    const doc = await TemplateModel.findOne({
      _id: id,
      ...templateListScopeOr(workspaceId),
    } as never).exec();
    if (!doc) return null;
    const d = doc as TemplateDoc & {
      vertical?: string;
      prerequisites?: string[];
      applyBehavior?: string;
      validationSteps?: string[];
      goldenPrompts?: string[];
      expectedOutcome?: string;
      templatePayload?: TTeamTemplateExportPayload;
      templateScope?: string;
    };
    const tc = (d.teamConfig as Record<string, unknown>) ?? {};
    const agents = (d.agentsSnapshot as Array<{ id?: string; name?: string; role?: string }>) ?? [];
    const p = d.templatePayload;
    return {
      id: d._id.toString(),
      name: d.name,
      description: d.description,
      version: d.version,
      origin: d.origin,
      category: d.category,
      agentCount: d.agentCount,
      hasFullPayload: Boolean(p),
      templateScope: d.templateScope ?? 'workspace',
      vertical: typeof d.vertical === 'string' ? d.vertical : '',
      prerequisites: Array.isArray(d.prerequisites) ? d.prerequisites : [],
      applyBehavior: typeof d.applyBehavior === 'string' ? d.applyBehavior : '',
      validationSteps: Array.isArray(d.validationSteps) ? d.validationSteps : [],
      goldenPrompts: Array.isArray(d.goldenPrompts) ? d.goldenPrompts : [],
      expectedOutcome: typeof d.expectedOutcome === 'string' ? d.expectedOutcome : '',
      teamConfig: {
        name: tc['name'] ?? d.name,
        description: tc['description'] ?? d.description,
      },
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
      })),
      graph: d.graph ?? { nodes: [], edges: [] },
      templatePayload: p,
      credentialSlots: getCredentialSlotsForTemplate(p),
    };
  }

  async deleteCompany(workspaceId: string, id: string) {
    const cur = await TemplateModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec() as { templateScope?: string } | null;
    if (!cur) return false;
    if (cur['templateScope'] === 'global') return false;
    const r = await TemplateModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
      origin: 'company',
    });
    return r.deletedCount === 1;
  }

  async createWithTemplatePayload(
    workspaceId: string,
    input: {
      name: string;
      description: string;
      category: string;
      origin: 'whitebeard' | 'company';
      templateScope?: 'workspace' | 'global';
      templatePayload: TTeamTemplateExportPayload;
    },
  ) {
    const agents = input.templatePayload.agents;
    const teamT = input.templatePayload.team as Record<string, unknown>;
    const agSnap = agents.map((exp) => {
      const a = exp.agent as { id?: string; name?: string; role?: string } | undefined;
      return { id: a?.id, name: a?.name, role: a?.role };
    });
    const doc = await TemplateModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      origin: input.origin,
      name: input.name,
      description: input.description,
      category: input.category,
      version: '1.0.0',
      agentCount: agents.length,
      teamConfig: {
        name: teamT['name'] ?? input.name,
        description: teamT['description'] ?? input.description,
        objective: teamT['objective'],
      },
      graph: input.templatePayload.graph ?? { nodes: [], edges: [] },
      agentsSnapshot: agSnap,
      templatePayload: input.templatePayload,
      templateScope: input.templateScope ?? 'workspace',
    });

    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      version: doc.version,
      origin: doc.origin,
      category: doc.category,
      agentCount: doc.agentCount,
    };
  }

  /**
   * Metadados e/ou substituição de `templatePayload` — só `origin: company` no workspace (não global).
   */
  async updateCompany(
    workspaceId: string,
    id: string,
    patch: {
      name?: string;
      description?: string;
      category?: string;
      vertical?: string;
      prerequisites?: string[];
      applyBehavior?: string;
      validationSteps?: string[];
      goldenPrompts?: string[];
      expectedOutcome?: string;
      templatePayload?: TTeamTemplateExportPayload;
    },
  ) {
    const cur = await TemplateModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
      origin: 'company',
    }).exec();
    if (!cur) return null;
    if ((cur as { templateScope?: string }).templateScope === 'global') return null;

    const $set: Record<string, unknown> = {};
    if (patch.name !== undefined) $set.name = patch.name;
    if (patch.description !== undefined) $set.description = patch.description;
    if (patch.category !== undefined) $set.category = patch.category;
    if (patch.vertical !== undefined) $set.vertical = patch.vertical;
    if (patch.prerequisites !== undefined) $set.prerequisites = patch.prerequisites;
    if (patch.applyBehavior !== undefined) $set.applyBehavior = patch.applyBehavior;
    if (patch.validationSteps !== undefined) $set.validationSteps = patch.validationSteps;
    if (patch.goldenPrompts !== undefined) $set.goldenPrompts = patch.goldenPrompts;
    if (patch.expectedOutcome !== undefined) $set.expectedOutcome = patch.expectedOutcome;

    if (patch.templatePayload) {
      const agents = patch.templatePayload.agents;
      const teamT = patch.templatePayload.team as Record<string, unknown>;
      const agSnap = agents.map((exp) => {
        const a = exp.agent as { id?: string; name?: string; role?: string } | undefined;
        return { id: a?.id, name: a?.name, role: a?.role };
      });
      $set.templatePayload = patch.templatePayload;
      $set.agentCount = agents.length;
      $set.teamConfig = {
        name: teamT['name'] ?? cur.name,
        description: teamT['description'] ?? cur.description,
        objective: teamT['objective'],
      };
      $set.graph = patch.templatePayload.graph ?? { nodes: [], edges: [] };
      $set.agentsSnapshot = agSnap;
    }

    const doc = await TemplateModel.findOneAndUpdate(
      {
        _id: id,
        workspaceId: new Types.ObjectId(workspaceId),
        origin: 'company',
      },
      { $set },
      { new: true },
    ).exec();
    if (!doc) return null;
    return toListItem(doc as unknown as TemplateDoc);
  }

  /**
   * @deprecated use `createWithTemplatePayload` com `buildSanitizedTemplatePayload` na rota.
   */
  async saveFromTeam(
    workspaceId: string,
    input: { teamId: string; name: string; description: string; category: string },
  ) {
    const team = (await TeamModel.findOne({
      _id: input.teamId,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec()) as TeamDoc | null;
    if (!team) return null;

    const graphDoc = (await TeamGraphModel.findOne({
      teamId: team._id,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .lean()
      .exec()) as TeamGraphDoc | null;

    const agentIds = (team.agentIds ?? []) as Types.ObjectId[];
    const coordId = team.coordinatorId as Types.ObjectId;
    const allIds = [...new Set([coordId.toString(), ...agentIds.map((x) => x.toString())])];
    const agents = (await AgentModel.find({
      _id: { $in: allIds.map((i) => new Types.ObjectId(i)) },
      workspaceId: new Types.ObjectId(workspaceId),
      ...notDeleted(),
    })
      .lean()
      .exec()) as unknown as AgentDoc[];

    const agentsSnapshot = agents.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      role: a.role,
    }));

    const doc = await TemplateModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      origin: 'company',
      name: input.name,
      description: input.description,
      category: input.category,
      version: '1.0.0',
      agentCount: agents.length,
      teamConfig: {
        name: team.name,
        description: team.description,
        objective: team.objective,
      },
      graph: graphDoc
        ? { nodes: graphDoc.nodes ?? [], edges: graphDoc.edges ?? [] }
        : { nodes: [], edges: [] },
      agentsSnapshot,
    });

    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      version: doc.version,
      origin: doc.origin,
      category: doc.category,
      agentCount: doc.agentCount,
    };
  }

  /**
   * Fluxo legado: sem `templatePayload` no documento (seeds antigos / saveFromTeam leve).
   */
  async applyLegacy(
    workspaceId: string,
    templateId: string,
    input: { teamName: string; teamDescription?: string },
  ) {
    const tpl = (await TemplateModel.findOne({
      _id: templateId,
      ...templateListScopeOr(workspaceId),
    } as never)
      .lean()
      .exec()) as (TemplateDoc & { templatePayload?: unknown }) | null;
    if (!tpl) return null;
    if ((tpl as { templatePayload?: unknown }).templatePayload) {
      return null;
    }

    const coord = (await AgentModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      role: 'coordinator',
      ...notDeleted(),
    })
      .sort({ name: 1 })
      .lean()
      .exec()) as AgentDoc | null;

    if (!coord) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Nenhum agente coordenador no workspace',
        400,
      );
    }

    const snap = (tpl.agentsSnapshot as Array<{ name?: string }>) ?? [];
    const nameToAgentId = new Map<string, string>();
    for (const s of snap) {
      if (!s.name) continue;
      const ag = (await AgentModel.findOne({
        workspaceId: new Types.ObjectId(workspaceId),
        name: s.name,
        ...notDeleted(),
      })
        .lean()
        .exec()) as AgentDoc | null;
      if (ag) nameToAgentId.set(s.name.toLowerCase(), ag._id.toString());
    }

    const team = await TeamModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: input.teamName,
      description: input.teamDescription ?? (tpl.teamConfig as { description?: string })?.description ?? '',
      status: 'draft',
      coordinatorId: coord._id,
      agentIds: [...new Set(nameToAgentId.values())].map((id) => new Types.ObjectId(id)),
      channelIds: [] as unknown as Types.ObjectId[],
    });

    const g = tpl.graph as { nodes?: unknown[]; edges?: unknown[] } | undefined;

    await TeamGraphModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: team._id,
      nodes: g?.nodes ?? [],
      edges: g?.edges ?? [],
    });

    return {
      teamId: team._id.toString(),
      name: team.name,
      status: team.status,
      message: 'Time criado a partir do template (modo legado por nome de agente)',
    };
  }
}
