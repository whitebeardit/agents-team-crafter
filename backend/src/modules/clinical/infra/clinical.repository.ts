import { Types } from 'mongoose';
import { AnamnesisModel } from './anamnesis.model.js';
import { EvolutionNoteModel } from './evolution-note.model.js';
import { EncounterModel } from '../../packages-encounters/infra/encounter.model.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';

export class ClinicalRepository {
  constructor(private readonly parties: PartyRepository) {}

  async createAnamnesis(
    workspaceId: string,
    input: { careSubjectId: string; template?: string; content: unknown },
  ) {
    const doc = await AnamnesisModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      template: input.template ?? 'custom',
      content: input.content,
    });
    return { id: doc._id.toString(), careSubjectId: input.careSubjectId };
  }

  async addEvolutionNote(workspaceId: string, input: { careSubjectId: string; body: string }) {
    const doc = await EvolutionNoteModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      body: input.body.trim(),
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
    input: { partyId: string; careSubjectId: string; notes?: string },
  ) {
    const doc = await EncounterModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      careSubjectId: new Types.ObjectId(input.careSubjectId),
      encounterKind: 'clinical',
      clinicalStatus: 'open',
      notes: input.notes ?? '',
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
}
