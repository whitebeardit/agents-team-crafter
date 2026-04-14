import { Types } from 'mongoose';
import type { UpdateQuery } from 'mongoose';
import { PartyModel } from './party.model.js';

export type PartyOptionalFieldKey = 'email' | 'phone' | 'notes';

export type IPartyUpdateOperation = {
  set: Partial<{
    displayName: string;
    roles: string[];
    email: string;
    phone: string;
    notes: string;
    status: 'active' | 'inactive';
  }>;
  unset: PartyOptionalFieldKey[];
};

export class PartyRepository {
  private computeReadinessDiagnostics(input: {
    total: number;
    inactive: number;
    withoutEmail: number;
    withoutPhone: number;
    updatedLast7d: number;
  }) {
    const checks: Array<{
      code: string;
      status: 'ok' | 'attention' | 'critical';
      message: string;
      nextStep: string;
      value: number;
    }> = [];

    if (input.total === 0) {
      checks.push({
        code: 'crm_no_contacts',
        status: 'critical',
        message: 'CRM sem contatos cadastrados.',
        nextStep: 'Criar ao menos um contato para ativar os fluxos operacionais de CRM.',
        value: 0,
      });
    } else {
      checks.push({
        code: 'crm_has_contacts',
        status: 'ok',
        message: 'CRM com contatos cadastrados.',
        nextStep: 'Manter cadência de atualização dos contatos principais.',
        value: input.total,
      });
    }

    if (input.withoutEmail > 0) {
      checks.push({
        code: 'crm_contacts_without_email',
        status: 'attention',
        message: 'Existem contatos sem e-mail.',
        nextStep: 'Completar e-mail nos contatos críticos para melhorar lookup e comunicação.',
        value: input.withoutEmail,
      });
    }
    if (input.withoutPhone > 0) {
      checks.push({
        code: 'crm_contacts_without_phone',
        status: 'attention',
        message: 'Existem contatos sem telefone.',
        nextStep: 'Completar telefone para canais que dependem de contato direto.',
        value: input.withoutPhone,
      });
    }
    if (input.total > 0 && input.updatedLast7d === 0) {
      checks.push({
        code: 'crm_stale_contacts',
        status: 'attention',
        message: 'Nenhum contato foi atualizado nos últimos 7 dias.',
        nextStep: 'Revisar carteira e atualizar status/notas dos contatos mais relevantes.',
        value: 0,
      });
    }
    if (input.total > 0 && input.inactive === input.total) {
      checks.push({
        code: 'crm_all_inactive',
        status: 'critical',
        message: 'Todos os contatos estão inativos.',
        nextStep: 'Reativar contatos válidos ou criar novos contatos ativos.',
        value: input.inactive,
      });
    }

    const health = checks.some((c) => c.status === 'critical')
      ? 'critical'
      : checks.some((c) => c.status === 'attention')
        ? 'attention'
        : 'ok';
    return { health, checks };
  }

  async create(
    workspaceId: string,
    input: {
      displayName: string;
      roles?: string[];
      status?: 'active' | 'inactive';
      email?: string;
      phone?: string;
      notes?: string;
    },
  ) {
    const doc = await PartyModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      displayName: input.displayName.trim(),
      roles: input.roles ?? [],
      status: input.status ?? 'active',
      email: input.email?.trim(),
      phone: input.phone?.trim(),
      notes: input.notes?.trim(),
    });
    return this.toPublic(doc);
  }

  async update(workspaceId: string, partyId: string, op: IPartyUpdateOperation) {
    const update: UpdateQuery<unknown> = {};
    if (Object.keys(op.set).length > 0) {
      update.$set = op.set;
    }
    if (op.unset.length > 0) {
      update.$unset = Object.fromEntries(op.unset.map((k) => [k, 1]));
    }
    if (Object.keys(update).length === 0) {
      return null;
    }
    const doc = await PartyModel.findOneAndUpdate(
      { _id: partyId, workspaceId: new Types.ObjectId(workspaceId) },
      update,
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findById(workspaceId: string, partyId: string) {
    const doc = await PartyModel.findOne({
      _id: partyId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async findByQuery(workspaceId: string, query: string, limit = 20) {
    const q = query.trim();
    if (!q) return [];
    const docs = await PartyModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      displayName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async findByEmailOrPhone(
    workspaceId: string,
    opts: {
      email?: string;
      phone?: string;
      limit?: number;
    },
  ) {
    const email = opts.email?.trim();
    const phone = opts.phone?.trim();
    if (!email && !phone) return [];
    const clauses: Record<string, unknown>[] = [];
    if (email) clauses.push({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (phone) clauses.push({ phone });
    const docs = await PartyModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      $or: clauses,
    })
      .limit(Math.min(Math.max(opts.limit ?? 20, 1), 100))
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  /** Lista recente para pickers (sem query). */
  async listRecent(workspaceId: string, limit = 30) {
    const docs = await PartyModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async listByRole(workspaceId: string, role: string, limit = 50) {
    const docs = await PartyModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      roles: role.trim(),
    })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async readinessSummary(workspaceId: string) {
    const wid = new Types.ObjectId(workspaceId);
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const [total, inactive, withoutEmail, withoutPhone, updatedLast7d] = await Promise.all([
      PartyModel.countDocuments({ workspaceId: wid }),
      PartyModel.countDocuments({ workspaceId: wid, status: 'inactive' }),
      PartyModel.countDocuments({ workspaceId: wid, $or: [{ email: { $exists: false } }, { email: '' }] }),
      PartyModel.countDocuments({ workspaceId: wid, $or: [{ phone: { $exists: false } }, { phone: '' }] }),
      PartyModel.countDocuments({ workspaceId: wid, updatedAt: { $gte: sevenDaysAgo } }),
    ]);
    const active = Math.max(total - inactive, 0);
    const diagnostics = this.computeReadinessDiagnostics({
      total,
      inactive,
      withoutEmail,
      withoutPhone,
      updatedLast7d,
    });
    return {
      total,
      active,
      inactive,
      withoutEmail,
      withoutPhone,
      updatedLast7d,
      health: diagnostics.health,
      checks: diagnostics.checks,
      generatedAt: new Date(now).toISOString(),
    };
  }

  async goldGateSummary(workspaceId: string) {
    const readiness = await this.readinessSummary(workspaceId);
    const criteria = [
      {
        code: 'crm_contacts_exist',
        label: 'Base mínima de contatos',
        passed: readiness.total > 0,
        detail: readiness.total > 0 ? 'CRM possui contatos cadastrados.' : 'CRM ainda sem contatos cadastrados.',
      },
      {
        code: 'crm_active_contacts',
        label: 'Contatos ativos para operação',
        passed: readiness.active > 0,
        detail:
          readiness.active > 0
            ? 'Existe ao menos um contato ativo.'
            : 'Não há contatos ativos para os fluxos operacionais.',
      },
      {
        code: 'crm_recent_updates',
        label: 'Atualização operacional recente',
        passed: readiness.total === 0 ? false : readiness.updatedLast7d > 0,
        detail:
          readiness.updatedLast7d > 0
            ? 'Houve atualização de contatos nos últimos 7 dias.'
            : 'Sem atualização recente nos últimos 7 dias.',
      },
      {
        code: 'crm_troubleshooting_signal',
        label: 'Sinal de troubleshooting',
        passed: readiness.health !== 'critical',
        detail:
          readiness.health !== 'critical'
            ? 'Readiness sem bloqueios críticos.'
            : 'Readiness com bloqueio crítico pendente.',
      },
    ];
    const blockingCriteria = criteria.filter((c) => !c.passed);
    const approved = blockingCriteria.length === 0;
    return {
      approved,
      evaluatedAt: readiness.generatedAt,
      criteria,
      blockingCriteria,
      readiness,
    };
  }

  /**
   * Listagem com filtros opcionais (Loop 87). `query` vazio não bloqueia a listagem.
   */
  async listParties(
    workspaceId: string,
    opts: {
      query?: string;
      roles?: string[];
      status?: 'active' | 'inactive';
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const wid = new Types.ObjectId(workspaceId);
    const q = (opts.query ?? '').trim();
    const parts: Record<string, unknown>[] = [{ workspaceId: wid }];
    if (q) {
      parts.push({
        displayName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      });
    }
    if (opts.roles && opts.roles.length > 0) {
      const rs = opts.roles.map((r) => r.trim()).filter(Boolean);
      if (rs.length > 0) {
        parts.push({ roles: { $in: rs } });
      }
    }
    if (opts.status === 'active') {
      parts.push({ $or: [{ status: 'active' }, { status: { $exists: false } }] });
    } else if (opts.status === 'inactive') {
      parts.push({ status: 'inactive' });
    }
    const filter = parts.length === 1 ? parts[0]! : { $and: parts };
    const docs = await PartyModel.find(filter).sort({ updatedAt: -1 }).limit(limit).exec();
    return docs.map((d) => this.toPublic(d));
  }

  private toPublic(d: {
    _id: Types.ObjectId;
    displayName: string;
    roles?: string[];
    status?: string;
    email?: string;
    phone?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const st = d.status === 'inactive' ? 'inactive' : 'active';
    return {
      id: d._id.toString(),
      displayName: d.displayName,
      roles: d.roles ?? [],
      status: st,
      email: d.email,
      phone: d.phone,
      notes: d.notes,
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    };
  }
}
