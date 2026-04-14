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

  async goldGateSummary(workspaceId: string, catalogCount: number) {
    const ws = new Types.ObjectId(workspaceId);
    const [orderStats, paidByService] = await Promise.all([
      ServiceOrderModel.aggregate<{ _id: string; total: number }>([
        { $match: { workspaceId: ws } },
        { $group: { _id: '$status', total: { $sum: 1 } } },
      ]),
      this.totalPaidByService(workspaceId),
    ]);
    const totalOrders = orderStats.reduce((acc, item) => acc + item.total, 0);
    const openOrders = orderStats.find((item) => item._id === 'open')?.total ?? 0;
    const paidOrders = orderStats.find((item) => item._id === 'paid')?.total ?? 0;
    const grossPaid = paidByService.reduce((acc, item) => acc + item.totalPaid, 0);
    const criteria = [
      {
        code: 'sales_has_catalog',
        label: 'Catálogo de serviços publicado',
        passed: catalogCount > 0,
        detail:
          catalogCount > 0
            ? `Há ${catalogCount} item(ns) no catálogo.`
            : 'Nenhum item de serviço publicado no catálogo.',
      },
      {
        code: 'sales_has_orders',
        label: 'Pedidos de serviço registrados',
        passed: totalOrders > 0,
        detail:
          totalOrders > 0
            ? `Há ${totalOrders} pedido(s) de serviço registrados.`
            : 'Nenhum pedido de serviço registrado no momento.',
      },
      {
        code: 'sales_has_paid_orders',
        label: 'Pedidos com pagamento confirmado',
        passed: paidOrders > 0,
        detail:
          paidOrders > 0
            ? `Há ${paidOrders} pedido(s) pagos.`
            : 'Nenhum pedido pago identificado no momento.',
      },
      {
        code: 'sales_has_paid_totals_by_service',
        label: 'Totais por serviço calculáveis',
        passed: paidByService.length > 0 && grossPaid > 0,
        detail:
          paidByService.length > 0 && grossPaid > 0
            ? 'Existem totais pagos consolidados por serviço.'
            : 'Ainda não há totais pagos por serviço para consolidação.',
      },
      {
        code: 'sales_open_orders_under_control',
        label: 'Pedidos em aberto sob controle',
        passed: totalOrders === 0 || openOrders <= paidOrders + 5,
        detail:
          totalOrders === 0 || openOrders <= paidOrders + 5
            ? 'Volume de pedidos em aberto está em faixa operacional.'
            : `Há ${openOrders} pedidos em aberto para ${paidOrders} pagos; revisar operação.`,
      },
    ];
    const blockingCriteria = criteria.filter((criterion) => !criterion.passed);
    return {
      approved: blockingCriteria.length === 0,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        catalogCount,
        totalOrders,
        openOrders,
        paidOrders,
        paidServices: paidByService.length,
        grossPaid,
      },
    };
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
