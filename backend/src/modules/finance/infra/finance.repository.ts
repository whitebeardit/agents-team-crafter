import { Types } from 'mongoose';
import { ReceivableModel } from './receivable.model.js';
import { PayableModel } from './payable.model.js';

export type IFinanceDeleteBlocker = { domain: string; count: number };

export class FinanceRepository {
  async createReceivable(
    workspaceId: string,
    input: { partyId: string; amount: number; dueDate: string; description?: string; currency?: string },
  ) {
    const doc = await ReceivableModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(input.partyId),
      amount: input.amount,
      currency: input.currency ?? 'BRL',
      dueDate: new Date(input.dueDate),
      paid: false,
      description: input.description ?? '',
    });
    return { id: doc._id.toString(), kind: 'receivable' as const };
  }

  async createPayable(
    workspaceId: string,
    input: {
      destinationPartyId: string;
      amount: number;
      dueDate: string;
      description?: string;
      currency?: string;
    },
  ) {
    const doc = await PayableModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      destinationPartyId: new Types.ObjectId(input.destinationPartyId),
      amount: input.amount,
      currency: input.currency ?? 'BRL',
      dueDate: new Date(input.dueDate),
      paid: false,
      description: input.description ?? '',
    });
    return { id: doc._id.toString(), kind: 'payable' as const };
  }

  async markReceivablePaid(workspaceId: string, id: string) {
    const doc = await ReceivableModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { paid: true } },
      { new: true },
    ).exec();
    return doc ? { id: doc._id.toString(), paid: true } : null;
  }

  async markPayablePaid(workspaceId: string, id: string) {
    const doc = await PayableModel.findOneAndUpdate(
      { _id: id, workspaceId: new Types.ObjectId(workspaceId) },
      { $set: { paid: true } },
      { new: true },
    ).exec();
    return doc ? { id: doc._id.toString(), paid: true } : null;
  }

  async listReceivablesByDateRange(
    workspaceId: string,
    input: { startDate: string; endDate: string; paid?: boolean; limit?: number },
  ) {
    const cap = Math.min(Math.max(1, input.limit ?? 300), 1000);
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T23:59:59.999Z`);
    const docs = await ReceivableModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      dueDate: { $gte: start, $lte: end },
      ...(typeof input.paid === 'boolean' ? { paid: input.paid } : {}),
    })
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(cap)
      .exec();
    return docs.map((doc) => this.pubReceivable(doc));
  }

  async listPayablesByDateRange(
    workspaceId: string,
    input: { startDate: string; endDate: string; paid?: boolean; limit?: number },
  ) {
    const cap = Math.min(Math.max(1, input.limit ?? 300), 1000);
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T23:59:59.999Z`);
    const docs = await PayableModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      dueDate: { $gte: start, $lte: end },
      ...(typeof input.paid === 'boolean' ? { paid: input.paid } : {}),
    })
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(cap)
      .exec();
    return docs.map((doc) => this.pubPayable(doc));
  }

  async getReceivableDeleteBlockers(workspaceId: string, receivableId: string): Promise<IFinanceDeleteBlocker[]> {
    const ws = new Types.ObjectId(workspaceId);
    const linked = await ReceivableModel.countDocuments({
      workspaceId: ws,
      _id: receivableId,
      sourceEntity: { $exists: true, $ne: null },
      sourceId: { $exists: true, $ne: null },
    });
    const out: IFinanceDeleteBlocker[] = [];
    if (linked > 0) out.push({ domain: 'linkedSource', count: linked });
    return out;
  }

  async getPayableDeleteBlockers(workspaceId: string, payableId: string): Promise<IFinanceDeleteBlocker[]> {
    const ws = new Types.ObjectId(workspaceId);
    const linked = await PayableModel.countDocuments({
      workspaceId: ws,
      _id: payableId,
      sourceEntity: { $exists: true, $ne: null },
      sourceId: { $exists: true, $ne: null },
    });
    const out: IFinanceDeleteBlocker[] = [];
    if (linked > 0) out.push({ domain: 'linkedSource', count: linked });
    return out;
  }

  async deleteReceivableById(workspaceId: string, receivableId: string): Promise<boolean> {
    const res = await ReceivableModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      _id: receivableId,
    }).exec();
    return (res.deletedCount ?? 0) > 0;
  }

  async deletePayableById(workspaceId: string, payableId: string): Promise<boolean> {
    const res = await PayableModel.deleteOne({
      workspaceId: new Types.ObjectId(workspaceId),
      _id: payableId,
    }).exec();
    return (res.deletedCount ?? 0) > 0;
  }

  async listOverdueReceivables(workspaceId: string) {
    const now = new Date();
    const docs = await ReceivableModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      paid: false,
      dueDate: { $lt: now },
    }).exec();
    return docs.map((d) => ({
      id: d._id.toString(),
      partyId: d.partyId.toString(),
      amount: d.amount,
      dueDate: d.dueDate.toISOString(),
    }));
  }

  async listOverduePayables(workspaceId: string) {
    const now = new Date();
    const docs = await PayableModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      paid: false,
      dueDate: { $lt: now },
    }).exec();
    return docs.map((d) => ({
      id: d._id.toString(),
      destinationPartyId: d.destinationPartyId.toString(),
      amount: d.amount,
      dueDate: d.dueDate.toISOString(),
    }));
  }

  async totalReceivableByPayer(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const agg = await ReceivableModel.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { workspaceId: ws, paid: false } },
      { $group: { _id: '$partyId', total: { $sum: '$amount' } } },
    ]);
    return agg.map((a) => ({ partyId: a._id.toString(), totalOpen: a.total }));
  }

  async totalPayableByDestination(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const agg = await PayableModel.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { workspaceId: ws, paid: false } },
      { $group: { _id: '$destinationPartyId', total: { $sum: '$amount' } } },
    ]);
    return agg.map((a) => ({ partyId: a._id.toString(), totalOpen: a.total }));
  }

  async customerFinancialSummary(workspaceId: string, partyId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const pid = new Types.ObjectId(partyId);
    const [recv, pay] = await Promise.all([
      ReceivableModel.aggregate<{ total: number }>([
        { $match: { workspaceId: ws, partyId: pid, paid: false } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PayableModel.aggregate<{ total: number }>([
        { $match: { workspaceId: ws, destinationPartyId: pid, paid: false } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    return {
      openReceivables: recv[0]?.total ?? 0,
      openPayables: pay[0]?.total ?? 0,
    };
  }

  async goldGateSummary(workspaceId: string) {
    const [overdueReceivables, overduePayables, receivableTotals, payableTotals] = await Promise.all([
      this.listOverdueReceivables(workspaceId),
      this.listOverduePayables(workspaceId),
      this.totalReceivableByPayer(workspaceId),
      this.totalPayableByDestination(workspaceId),
    ]);
    const openReceivables = receivableTotals.reduce((acc, item) => acc + item.totalOpen, 0);
    const openPayables = payableTotals.reduce((acc, item) => acc + item.totalOpen, 0);
    const criteria = [
      {
        code: 'finance_has_open_titles',
        label: 'Base financeira ativa',
        passed: openReceivables > 0 || openPayables > 0,
        detail:
          openReceivables > 0 || openPayables > 0
            ? 'Existem títulos financeiros abertos para operação.'
            : 'Ainda não existem títulos financeiros abertos.',
      },
      {
        code: 'finance_no_overdue_receivables',
        label: 'Recebíveis vencidos sob controle',
        passed: overdueReceivables.length === 0,
        detail:
          overdueReceivables.length === 0
            ? 'Não há recebíveis vencidos no momento.'
            : `Há ${overdueReceivables.length} recebível(is) vencido(s).`,
      },
      {
        code: 'finance_no_overdue_payables',
        label: 'Pagáveis vencidos sob controle',
        passed: overduePayables.length === 0,
        detail:
          overduePayables.length === 0
            ? 'Não há pagáveis vencidos no momento.'
            : `Há ${overduePayables.length} pagável(is) vencido(s).`,
      },
    ];
    const blockingCriteria = criteria.filter((c) => !c.passed);
    const approved = blockingCriteria.length === 0;
    return {
      approved,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        openReceivables,
        openPayables,
        overdueReceivables: overdueReceivables.length,
        overduePayables: overduePayables.length,
      },
    };
  }

  private pubReceivable(doc: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    amount: number;
    currency?: string;
    dueDate: Date;
    paid: boolean;
    description?: string;
    sourceEntity?: string;
    sourceId?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      amount: doc.amount,
      currency: doc.currency ?? 'BRL',
      dueDate: doc.dueDate.toISOString(),
      paid: Boolean(doc.paid),
      description: doc.description ?? '',
      sourceEntity: doc.sourceEntity,
      sourceId: doc.sourceId?.toString(),
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  private pubPayable(doc: {
    _id: Types.ObjectId;
    destinationPartyId: Types.ObjectId;
    amount: number;
    currency?: string;
    dueDate: Date;
    paid: boolean;
    description?: string;
    sourceEntity?: string;
    sourceId?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: doc._id.toString(),
      destinationPartyId: doc.destinationPartyId.toString(),
      amount: doc.amount,
      currency: doc.currency ?? 'BRL',
      dueDate: doc.dueDate.toISOString(),
      paid: Boolean(doc.paid),
      description: doc.description ?? '',
      sourceEntity: doc.sourceEntity,
      sourceId: doc.sourceId?.toString(),
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }
}
