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
}
