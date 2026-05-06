import { Types } from 'mongoose';
import { AnamnesisModel } from './anamnesis.model.js';
import { EvolutionNoteModel } from './evolution-note.model.js';
import { EncounterModel } from '../../packages-encounters/infra/encounter.model.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import { resolveRecordOrigin, type TRecordOrigin } from '../../../shared/kernel/record-origin.js';

export class ClinicalRepository {
  constructor(private readonly parties: PartyRepository) {}

  async createAnamnesis(
    workspaceId: string,
    input: {
      careSubjectId: string;
      template?: string;
      content: unknown;
      origin?: Partial<TRecordOrigin>;
      teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
      correlationId?: string;
    },
  ) {
    const origin = resolveRecordOrigin({
      explicit: input.origin,
      teamContext: input.teamContext,
      correlationId: input.correlationId,
      fallbackSlug: 'clinical_anamnesis',
    });
    const doc = await AnamnesisModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      template: input.template ?? 'custom',
      content: input.content,
      origin,
    });
    return { id: doc._id.toString(), careSubjectId: input.careSubjectId };
  }

  async addEvolutionNote(
    workspaceId: string,
    input: {
      careSubjectId: string;
      body: string;
      encounterId?: string;
      appointmentId?: string;
      origin?: Partial<TRecordOrigin>;
      teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
      correlationId?: string;
    },
  ) {
    const origin = resolveRecordOrigin({
      explicit: input.origin,
      teamContext: input.teamContext,
      correlationId: input.correlationId,
      fallbackSlug: 'clinical_evolution_note',
    });
    const doc = await EvolutionNoteModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      encounterId: input.encounterId ? new Types.ObjectId(input.encounterId) : undefined,
      appointmentId: input.appointmentId ? new Types.ObjectId(input.appointmentId) : undefined,
      body: input.body.trim(),
      origin,
    });
    return { id: doc._id.toString() };
  }

  async listSubjectHistory(workspaceId: string, careSubjectId: string) {
    const [anas, evos] = await Promise.all([
      AnamnesisModel.find({
        workspaceId: new Types.ObjectId(workspaceId),
        careSubjectId: new Types.ObjectId(careSubjectId),
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      EvolutionNoteModel.find({
        workspaceId: new Types.ObjectId(workspaceId),
        careSubjectId: new Types.ObjectId(careSubjectId),
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);
    return { anamneses: anas, evolutionNotes: evos };
  }

  async getLatestEvolution(workspaceId: string, careSubjectId: string) {
    const doc = await EvolutionNoteModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      careSubjectId: new Types.ObjectId(careSubjectId),
    })
      .sort({ createdAt: -1 })
      .exec();
    return doc ? { id: doc._id.toString(), body: doc.body, createdAt: doc.createdAt?.toISOString() } : null;
  }

  async openClinicalEncounter(
    workspaceId: string,
    input: {
      partyId: string;
      careSubjectId: string;
      notes?: string;
      origin?: Partial<TRecordOrigin>;
      teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
      correlationId?: string;
    },
  ) {
    const origin = resolveRecordOrigin({
      explicit: input.origin,
      teamContext: input.teamContext,
      correlationId: input.correlationId,
      fallbackSlug: 'clinical_encounter',
    });
    const doc = await EncounterModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      encounterKind: 'clinical',
      clinicalStatus: 'open',
      notes: input.notes ?? '',
      origin,
    });
    return { id: doc._id.toString() };
  }

  async closeClinicalEncounter(workspaceId: string, encounterId: string) {
    const doc = await EncounterModel.findOneAndUpdate(
      {
        _id: encounterId,
        workspaceId: new Types.ObjectId(workspaceId),
        encounterKind: 'clinical',
      },
      { $set: { clinicalStatus: 'closed' } },
      { new: true },
    ).exec();
    return doc ? { id: doc._id.toString(), clinicalStatus: 'closed' } : null;
  }

  async getPartyCareSummary(workspaceId: string, partyId: string) {
    const party = await this.parties.findById(workspaceId, partyId);
    const enc = await EncounterModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
      encounterKind: 'clinical',
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return { party, clinicalEncounters: enc };
  }

  async goldGateSummary(workspaceId: string) {
    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const [anamnesisCount, structuredAnamnesisCount, evolutionCount, encounterStats] = await Promise.all([
      AnamnesisModel.countDocuments({ workspaceId: workspaceObjectId }),
      AnamnesisModel.countDocuments({
        workspaceId: workspaceObjectId,
        content: { $type: 'object' },
      }),
      EvolutionNoteModel.countDocuments({ workspaceId: workspaceObjectId }),
      EncounterModel.aggregate<{ _id: string; total: number }>([
        { $match: { workspaceId: workspaceObjectId, encounterKind: 'clinical' } },
        { $group: { _id: '$clinicalStatus', total: { $sum: 1 } } },
      ]),
    ]);
    const totalEncounters = encounterStats.reduce((acc, item) => acc + item.total, 0);
    const openEncounters = encounterStats.find((item) => item._id === 'open')?.total ?? 0;
    const closedEncounters = encounterStats.find((item) => item._id === 'closed')?.total ?? 0;
    const criteria = [
      {
        code: 'clinical_has_anamnesis',
        label: 'Anamnese registada',
        passed: anamnesisCount > 0,
        detail:
          anamnesisCount > 0
            ? `Há ${anamnesisCount} anamnese(s) registada(s).`
            : 'Nenhuma anamnese registada no momento.',
      },
      {
        code: 'clinical_has_structured_content',
        label: 'Conteúdo estruturado disponível',
        passed: structuredAnamnesisCount > 0,
        detail:
          structuredAnamnesisCount > 0
            ? 'Ao menos uma anamnese possui conteúdo estruturado.'
            : 'Ainda não há anamnese com conteúdo estruturado.',
      },
      {
        code: 'clinical_has_evolution_notes',
        label: 'Evolução clínica registada',
        passed: evolutionCount > 0,
        detail:
          evolutionCount > 0
            ? `Há ${evolutionCount} nota(s) de evolução.`
            : 'Nenhuma nota de evolução registada no momento.',
      },
      {
        code: 'clinical_has_encounter_history',
        label: 'Histórico de encontros clínicos',
        passed: totalEncounters > 0,
        detail:
          totalEncounters > 0
            ? `Há ${totalEncounters} encontro(s) clínico(s) no histórico.`
            : 'Nenhum encontro clínico registado no momento.',
      },
      {
        code: 'clinical_no_open_encounters',
        label: 'Encontros em aberto sob controle',
        passed: openEncounters === 0,
        detail:
          openEncounters === 0
            ? 'Não há encontros clínicos em aberto.'
            : `Há ${openEncounters} encontro(s) clínico(s) ainda em aberto.`,
      },
    ];
    const blockingCriteria = criteria.filter((criterion) => !criterion.passed);
    const approved = blockingCriteria.length === 0;
    return {
      approved,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        anamnesisCount,
        structuredAnamnesisCount,
        evolutionCount,
        totalEncounters,
        closedEncounters,
        openEncounters,
      },
    };
  }
}
