import { Types } from 'mongoose';
import { ServiceOrderModel } from './service-order.model.js';

type Line = { catalogItemId: string; quantity: number; unitPrice: number };

export class ServiceOrderRepository {
  async create(workspaceId: string, partyId: string, lines: Line[]) {
    const doc = await ServiceOrderModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
      lines: lines.map((l) => ({
        catalogItemId: new Types.ObjectId(l.catalogItemId),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      status: 'open',
      totalPaid: 0,
    });
    return this.toPublic(doc);
  }

  async findById(workspaceId: string, id: string) {
    const doc = await ServiceOrderModel.findOne({
      _id: id,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async addLine(workspaceId: string, orderId: string, line: Line) {
    const doc = await ServiceOrderModel.findOneAndUpdate(
      { _id: orderId, workspaceId: new Types.ObjectId(workspaceId), status: 'open' },
      {
        $push: {
          lines: {
            catalogItemId: new Types.ObjectId(line.catalogItemId),
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          },
        },
      },
      { new: true },
    ).exec();
    return doc ? this.toPublic(doc) : null;
  }

  async markPaid(workspaceId: string, orderId: string) {
    const order = await ServiceOrderModel.findOne({
      _id: orderId,
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    if (!order) return null;
    const lines = order.lines as Array<{ quantity: number; unitPrice: number }>;
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    order.status = 'paid';
    order.totalPaid = total;
    await order.save();
    return this.toPublic(order);
  }

  async listByParty(workspaceId: string, partyId: string) {
    const docs = await ServiceOrderModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      partyId: new Types.ObjectId(partyId),
    }).exec();
    return docs.map((d) => this.toPublic(d));
  }

  async aggregateTopServices(workspaceId: string, limit = 20) {
    const ws = new Types.ObjectId(workspaceId);
    const agg = await ServiceOrderModel.aggregate<{ _id: Types.ObjectId; qty: number }>([
      { $match: { workspaceId: ws, status: 'paid' } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.catalogItemId',
          qty: { $sum: '$lines.quantity' },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: limit },
    ]);
    return agg.map((a) => ({ catalogItemId: a._id.toString(), quantity: a.qty }));
  }

  async totalPaidByService(workspaceId: string) {
    const ws = new Types.ObjectId(workspaceId);
    const agg = await ServiceOrderModel.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { workspaceId: ws, status: 'paid' } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.catalogItemId',
          total: { $sum: { $multiply: ['$lines.quantity', '$lines.unitPrice'] } },
        },
      },
    ]);
    return agg.map((a) => ({ catalogItemId: a._id.toString(), totalPaid: a.total }));
  }

  private toPublic(doc: {
    _id: Types.ObjectId;
    partyId: Types.ObjectId;
    lines: Array<{ catalogItemId: Types.ObjectId; quantity: number; unitPrice: number }>;
    status: string;
    totalPaid?: number;
  }) {
    return {
      id: doc._id.toString(),
      partyId: doc.partyId.toString(),
      lines: doc.lines.map((l) => ({
        catalogItemId: l.catalogItemId.toString(),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      status: doc.status,
      totalPaid: doc.totalPaid ?? 0,
    };
  }
}
