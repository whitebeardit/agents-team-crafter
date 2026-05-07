import { Types } from 'mongoose';
import { CareSubjectModel } from './care-subject.model.js';
import { resolveRecordOrigin, type TRecordOrigin } from '../../../shared/kernel/record-origin.js';

export class CareSubjectRepository {
  async create(
    workspaceId: string,
    input: {
      partyId: string;
      name: string;
      subjectKind: 'human' | 'animal' | 'psych';
      notes?: string;
      origin?: Partial<TRecordOrigin>;
      teamContext?: { teamId: string; teamName: string; gallerySubjectSlug?: string };
      correlationId?: string;
      actorAgentId?: string;
      actorRole?: 'coordinator' | 'specialist';
    },
  ) {
    const origin = resolveRecordOrigin({
      explicit: input.origin,
      teamContext: input.teamContext,
      actorContext: { agentId: input.actorAgentId, role: input.actorRole },
      correlationId: input.correlationId,
      fallbackSlug: 'care_subject',
    });
    const doc = await CareSubjectModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      name: input.name.trim(),
      subjectKind: input.subjectKind,
      notes: input.notes?.trim(),
      origin,
    });
    return this.toPublic(doc);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: Partial<{ name: string; subjectKind: 'human' | 'animal' | 'psych'; notes: string }>,
  ) {
    const doc = await CareSubjectModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: patch },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findById(workspaceId: string, id: string) {
    const doc = await CareSubjectModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async listByParty(workspaceId: string, partyId: string, limit = 50) {
    const docs = await CareSubjectModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async goldGateSummary(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const [totalSubjects, subjectsWithNotes, byKind, byParty] = await Promise.all([
      CareSubjectModel.countDocuments({ workspaceId: ws }),
      CareSubjectModel.countDocuments({
        workspaceId: ws,
        notes: { $exists: true, $ne: '' },
      }),
      CareSubjectModel.aggregate<{ _id: string; total: number }>([
        { $match: { workspaceId: ws } },
        { $group: { _id: '$subjectKind', total: { $sum: 1 } } },
      ]),
      CareSubjectModel.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { workspaceId: ws } },
        { $group: { _id: '$partyId', total: { $sum: 1 } } },
      ]),
    ]);
    const partiesWithSubjects = byParty.length;
    const avgSubjectsPerParty = partiesWithSubjects > 0 ? totalSubjects / partiesWithSubjects : 0;
    const kinds = byKind.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.total;
      return acc;
    }, {});
    const criteria = [
      {
        code: 'care_has_subjects',
        label: 'Sujeitos de cuidado cadastrados',
        passed: totalSubjects > 0,
        detail:
          totalSubjects > 0
            ? `Há ${totalSubjects} sujeito(s) cadastrado(s).`
            : 'Nenhum sujeito de cuidado cadastrado no momento.',
      },
      {
        code: 'care_has_party_linkage',
        label: 'Vínculo com parties observado',
        passed: partiesWithSubjects > 0,
        detail:
          partiesWithSubjects > 0
            ? `Sujeitos vinculados a ${partiesWithSubjects} party(s).`
            : 'Ainda não há vínculo operacional entre sujeito e party.',
      },
      {
        code: 'care_has_documented_notes',
        label: 'Documentação mínima por notas',
        passed: subjectsWithNotes > 0,
        detail:
          subjectsWithNotes > 0
            ? `Há ${subjectsWithNotes} sujeito(s) com notas preenchidas.`
            : 'Nenhum sujeito possui notas registradas no momento.',
      },
      {
        code: 'care_has_kind_classification',
        label: 'Classificação por tipo de sujeito',
        passed: Object.keys(kinds).length > 0,
        detail:
          Object.keys(kinds).length > 0
            ? `Tipos presentes: ${Object.keys(kinds).join(', ')}.`
            : 'Nenhuma classificação de sujeito encontrada.',
      },
      {
        code: 'care_subject_load_under_control',
        label: 'Carga operacional por party sob controle',
        passed: totalSubjects === 0 || avgSubjectsPerParty <= 30,
        detail:
          totalSubjects === 0 || avgSubjectsPerParty <= 30
            ? 'Distribuição de sujeitos por party está em faixa operacional.'
            : `Média de ${avgSubjectsPerParty.toFixed(1)} sujeito(s) por party; revisar segmentação.`,
      },
    ];
    const blockingCriteria = criteria.filter((criterion) => !criterion.passed);
    return {
      approved: blockingCriteria.length === 0,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        totalSubjects,
        subjectsWithNotes,
        partiesWithSubjects,
        avgSubjectsPerParty,
        kinds,
      },
    };
  }

  private toPublic(d: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    name: string;
    subjectKind: string;
    notes?: string;
    origin: TRecordOrigin;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: d._id.toString(),
      partyId: d.partyId.toString(),
      name: d.name,
      subjectKind: d.subjectKind,
      notes: d.notes,
      origin: d.origin,
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    };
  }
}
