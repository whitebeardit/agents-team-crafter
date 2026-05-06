import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { resolvePartyIdFromPartyOrPhone } from '../../crm/application/resolve-party-id-from-input.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { ClinicalRepository } from '../infra/clinical.repository.js';

export function registerClinicalPack(
  registry: BusinessToolRegistry,
  clinical: ClinicalRepository,
  parties: PartyRepository,
): void {
  registry.register('clinical_create_anamnesis', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    if (!careSubjectId) throw new Error('careSubjectId obrigatorio');
    return clinical.createAnamnesis(workspaceId, {
      careSubjectId,
      template: typeof data.template === 'string' ? data.template : undefined,
      content: data.content ?? {},
      teamContext,
      correlationId,
    });
  });

  registry.register('clinical_add_evolution_note', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    const body = typeof data.body === 'string' ? data.body : '';
    if (!careSubjectId || !body.trim()) throw new Error('careSubjectId e body obrigatorios');
    const encounterId = typeof data.encounterId === 'string' ? data.encounterId : undefined;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : undefined;
    return clinical.addEvolutionNote(workspaceId, { careSubjectId, body, encounterId, appointmentId, teamContext, correlationId });
  });

  registry.register('clinical_list_subject_history', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    if (!careSubjectId) throw new Error('careSubjectId obrigatorio');
    return clinical.listSubjectHistory(workspaceId, careSubjectId);
  });

  registry.register('clinical_get_latest_evolution', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    if (!careSubjectId) throw new Error('careSubjectId obrigatorio');
    const r = await clinical.getLatestEvolution(workspaceId, careSubjectId);
    if (!r) return { latest: null };
    return { latest: r };
  });

  registry.register('clinical_open_encounter', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId : '';
    if (!partyId || !careSubjectId) throw new Error('partyId ou phone e careSubjectId obrigatorios');
    return clinical.openClinicalEncounter(workspaceId, {
      partyId,
      careSubjectId,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      teamContext,
      correlationId,
    });
  });

  registry.register('clinical_close_encounter', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const encounterId = typeof data.encounterId === 'string' ? data.encounterId : '';
    if (!encounterId) throw new Error('encounterId obrigatorio');
    const r = await clinical.closeClinicalEncounter(workspaceId, encounterId);
    if (!r) throw new Error('Encontro nao encontrado');
    return r;
  });

  registry.register('clinical_gold_gate', async ({ workspaceId }) => clinical.goldGateSummary(workspaceId));
}
