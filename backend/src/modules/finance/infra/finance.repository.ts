import { Types } from 'mongoose';
import { ReceivableModel } from './receivable.model.js';
import { PayableModel } from './payable.model.js';

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
}
