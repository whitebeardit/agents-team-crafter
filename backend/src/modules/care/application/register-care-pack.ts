import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { CareSubjectRepository } from '../infra/care-subject.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';

const kinds = new Set(['human', 'animal', 'psych']);

function readNonEmptyString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveCarePartyIdOrThrow(params: {
  parties?: PartyRepository;
  workspaceId: string;
  data: Record<string, unknown>;
  actionId: 'care_create_subject' | 'care_update_subject';
  requirePartyIdentity: boolean;
}): Promise<string | undefined> {
  const directPartyId = readNonEmptyString(params.data, 'partyId');
  const phone = readNonEmptyString(params.data, 'phone');
  if (!params.parties) {
    if (params.requirePartyIdentity && !directPartyId && !phone) {
      throw new Error('partyId ou phone obrigatorio');
    }
    if (phone) {
      throw new Error(`${params.actionId} indisponivel: repositorio de party nao configurado para lookup por phone`);
    }
    return directPartyId;
  }

  let resolvedByPhonePartyId: string | undefined;
  if (phone) {
    const matches = await params.parties.findByEmailOrPhone(params.workspaceId, {
      phone,
      limit: 3,
    });
    if (matches.length === 0) {
      throw new Error('Phone nao encontrado no workspace para resolucao de party');
    }
    if (matches.length > 1) {
      throw new Error('Phone ambiguo no workspace: informe partyId explicito');
    }
    resolvedByPhonePartyId = matches[0]?.id;
  }

  const effectivePartyId = directPartyId ?? resolvedByPhonePartyId;
  if (params.requirePartyIdentity && !effectivePartyId) {
    throw new Error('partyId ou phone obrigatorio');
  }
  if (!effectivePartyId) return undefined;

  const party = await params.parties.findById(params.workspaceId, effectivePartyId);
  if (!party) {
    throw new Error('Party nao encontrada para o workspace informado');
  }

  if (directPartyId && resolvedByPhonePartyId && directPartyId !== resolvedByPhonePartyId) {
    throw new Error('partyId e phone referenciam parties diferentes');
  }
  return party.id;
}

export function registerCarePack(
  registry: BusinessToolRegistry,
  care: CareSubjectRepository,
  parties?: PartyRepository,
): void {
  registry.register('care_create_patient', async ({ workspaceId, input, teamContext, correlationId }) => {
    if (!parties) throw new Error('care_create_patient indisponivel: repositorio de party nao configurado');
    const data = input as Record<string, unknown>;
    const name = typeof data.name === 'string' ? data.name : '';
    if (!name.trim()) throw new Error('name obrigatorio');

    const rawRoles = Array.isArray(data.roles)
      ? data.roles.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    const roles = rawRoles.length > 0 ? rawRoles : ['customer', 'patient'];
    const party = await parties.create(workspaceId, {
      displayName: name.trim(),
      roles,
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      teamContext,
      correlationId,
    });
    const subject = await care.create(workspaceId, {
      partyId: party.id,
      name: name.trim(),
      subjectKind: 'psych',
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      teamContext,
      correlationId,
    });
    return { party, subject };
  });

  registry.register('care_create_subject', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolveCarePartyIdOrThrow({
      parties,
      workspaceId,
      data,
      actionId: 'care_create_subject',
      requirePartyIdentity: true,
    });
    const name = typeof data.name === 'string' ? data.name : '';
    const sk = typeof data.subjectKind === 'string' ? data.subjectKind : '';
    if (!partyId || !name.trim()) throw new Error('partyId e name obrigatorios');
    if (!kinds.has(sk)) throw new Error('subjectKind deve ser human, animal ou psych');
    return care.create(workspaceId, {
      partyId,
      name: name.trim(),
      subjectKind: sk as 'human' | 'animal' | 'psych',
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      teamContext,
      correlationId,
    });
  });

  registry.register('care_update_subject', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const subjectId = typeof data.subjectId === 'string' ? data.subjectId : '';
    if (!subjectId) throw new Error('subjectId obrigatorio');
    const existing = await care.findById(workspaceId, subjectId);
    if (!existing) throw new Error('Subject nao encontrado');

    const hintedPartyId = await resolveCarePartyIdOrThrow({
      parties,
      workspaceId,
      data,
      actionId: 'care_update_subject',
      requirePartyIdentity: false,
    });
    if (hintedPartyId && hintedPartyId !== existing.partyId) {
      throw new Error('partyId informado nao corresponde ao ownership do subject');
    }
    if (parties) {
      const owner = await parties.findById(workspaceId, existing.partyId);
      if (!owner) throw new Error('Party vinculada ao subject nao encontrada no workspace');
    }

    const patch: Parameters<CareSubjectRepository['update']>[2] = {};
    if (typeof data.name === 'string') patch.name = data.name;
    if (typeof data.subjectKind === 'string' && kinds.has(data.subjectKind)) {
      patch.subjectKind = data.subjectKind as 'human' | 'animal' | 'psych';
    }
    if (typeof data.notes === 'string') patch.notes = data.notes;
    const u = await care.update(workspaceId, subjectId, patch);
    if (!u) throw new Error('Subject nao encontrado');
    return u;
  });

  registry.register('care_find_subject', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const subjectId = typeof data.subjectId === 'string' ? data.subjectId : '';
    if (!subjectId) throw new Error('subjectId obrigatorio');
    const s = await care.findById(workspaceId, subjectId);
    if (!s) throw new Error('Subject nao encontrado');
    return s;
  });

  registry.register('care_get_subject_summary', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const subjectId = typeof data.subjectId === 'string' ? data.subjectId : '';
    if (!subjectId) throw new Error('subjectId obrigatorio');
    const s = await care.findById(workspaceId, subjectId);
    if (!s) throw new Error('Subject nao encontrado');
    return { summary: s };
  });

  registry.register('care_gold_gate', async ({ workspaceId }) => care.goldGateSummary(workspaceId));
}
