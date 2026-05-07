import { Types } from 'mongoose';
import { DateTime } from 'luxon';
import { AppointmentModel } from './appointment.model.js';
import { resolveRecordOrigin, type TRecordOrigin } from '../../../shared/kernel/record-origin.js';

function utcDayRange(dayIso: string) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dayIso.trim())
    ? new Date(`${dayIso.trim()}T00:00:00.000Z`)
    : new Date(dayIso);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

function localDayRangeUtc(dayIso: string, timezone: string) {
  const day = DateTime.fromISO(`${dayIso.trim()}T00:00:00`, { zone: timezone });
  if (!day.isValid) throw new Error('date (ISO dia) invalido');
  const startUtc = day.startOf('day').toUTC().toJSDate();
  const endUtc = day.endOf('day').toUTC().toJSDate();
  return { startUtc, endUtc };
}

export class AppointmentRepository {
  async create(
    workspaceId: string,
    input: {
      partyId: string;
      title: string;
      startsAt: string;
      endsAt: string;
      careSubjectId?: string;
      serviceOrderId?: string;
      packageSaleId?: string;
      encounterId?: string;
      reminderId?: string;
      notes?: string;
      status?: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
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
      fallbackSlug: 'schedule_appointment',
    });
    const doc = await AppointmentModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      careSubjectId: input.careSubjectId ? new Types.ObjectId(input.careSubjectId) : undefined,
      serviceOrderId: input.serviceOrderId ? new Types.ObjectId(input.serviceOrderId) : undefined,
      packageSaleId: input.packageSaleId ? new Types.ObjectId(input.packageSaleId) : undefined,
      encounterId: input.encounterId ? new Types.ObjectId(input.encounterId) : undefined,
      reminderId: input.reminderId ? new Types.ObjectId(input.reminderId) : undefined,
      title: input.title.trim(),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      notes: input.notes ?? '',
      status: input.status ?? 'scheduled',
      origin,
    });
    return this.toPublic(doc);
  }

  async findById(workspaceId: string, id: string) {
    const doc = await AppointmentModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async reschedule(
    workspaceId: string,
    id: string,
    input: { startsAt: string; endsAt: string; reminderId?: string; notes?: string },
  ) {
    const doc = await AppointmentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          reminderId: input.reminderId ? new Types.ObjectId(input.reminderId) : undefined,
          notes: input.notes,
          status: 'scheduled',
        },
      },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed',
  ) {
    const doc = await AppointmentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { status } },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async complete(
    workspaceId: string,
    id: string,
    input: { encounterId: string; notes?: string },
  ) {
    const doc = await AppointmentModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          status: 'completed',
          encounterId: new Types.ObjectId(input.encounterId),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  /**
   * Remove o documento da base (nao soft-delete). Chamado apenas para estados terminais operacionais.
   */
  async hardDelete(workspaceId: string, id: string): Promise<boolean> {
    const r = await AppointmentModel.deleteOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return r.deletedCount === 1;
  }

  async listByDate(workspaceId: string, dayIso: string) {
    const { start, end } = utcDayRange(dayIso);
    const docs = await AppointmentModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      startsAt: { $gte: start, $lte: end },
    })
      .sort({ startsAt: 1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  /**
   * Lista compromissos por dia na perspectiva de um fuso horário (dia local da clínica),
   * mantendo persistência em UTC.
   */
  async listByLocalDate(workspaceId: string, dayIso: string, timezone: string) {
    const { startUtc, endUtc } = localDayRangeUtc(dayIso, timezone);
    const docs = await AppointmentModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      startsAt: { $gte: startUtc, $lte: endUtc },
    })
      .sort({ startsAt: 1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  /** Compromissos de um paciente (party), mais recentes primeiro. */
  async listByParty(workspaceId: string, partyId: string, limit = 100) {
    const cap = Math.min(Math.max(1, limit), 200);
    const docs = await AppointmentModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    })
      .sort({ startsAt: -1 })
      .limit(cap)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  private toPublic(doc: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    careSubjectId?: Types.ObjectId;
    serviceOrderId?: Types.ObjectId;
    packageSaleId?: Types.ObjectId;
    encounterId?: Types.ObjectId;
    reminderId?: Types.ObjectId;
    title: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    status: string;
    origin: TRecordOrigin;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      careSubjectId: doc.careSubjectId?.toString(),
      serviceOrderId: doc.serviceOrderId?.toString(),
      packageSaleId: doc.packageSaleId?.toString(),
      encounterId: doc.encounterId?.toString(),
      reminderId: doc.reminderId?.toString(),
      title: doc.title,
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      notes: doc.notes ?? '',
      status: doc.status,
      origin: doc.origin,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
