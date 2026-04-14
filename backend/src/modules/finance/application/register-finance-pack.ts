import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { FinanceRepository } from '../infra/finance.repository.js';

export function registerFinancePack(registry: BusinessToolRegistry, finance: FinanceRepository): void {
  registry.register('finance_create_receivable', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    const amount = Number(data.amount);
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate : '';
    if (!partyId || Number.isNaN(amount) || !dueDate) throw new Error('partyId, amount e dueDate obrigatorios');
    return finance.createReceivable(workspaceId, {
      partyId,
      amount,
      dueDate,
      description: typeof data.description === 'string' ? data.description : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
    });
  });

  registry.register('finance_create_payable', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const destinationPartyId =
      typeof data.destinationPartyId === 'string' ? data.destinationPartyId : '';
    const amount = Number(data.amount);
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate : '';
    if (!destinationPartyId || Number.isNaN(amount) || !dueDate) {
      throw new Error('destinationPartyId, amount e dueDate obrigatorios');
    }
    return finance.createPayable(workspaceId, {
      destinationPartyId,
      amount,
      dueDate,
      description: typeof data.description === 'string' ? data.description : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
    });
  });

  registry.register('finance_mark_receivable_paid', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const id = typeof data.receivableId === 'string' ? data.receivableId : '';
    if (!id) throw new Error('receivableId obrigatorio');
    const r = await finance.markReceivablePaid(workspaceId, id);
    if (!r) throw new Error('Recebivel nao encontrado');
    return r;
  });

  registry.register('finance_mark_payable_paid', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const id = typeof data.payableId === 'string' ? data.payableId : '';
    if (!id) throw new Error('payableId obrigatorio');
    const r = await finance.markPayablePaid(workspaceId, id);
    if (!r) throw new Error('Pagavel nao encontrado');
    return r;
  });

  registry.register('finance_list_overdue_receivables', async ({ workspaceId }) => ({
    items: await finance.listOverdueReceivables(workspaceId),
  }));

  registry.register('finance_list_overdue_payables', async ({ workspaceId }) => ({
    items: await finance.listOverduePayables(workspaceId),
  }));

  registry.register('finance_total_receivable_by_payer', async ({ workspaceId }) => ({
    totals: await finance.totalReceivableByPayer(workspaceId),
  }));

  registry.register('finance_total_payable_by_destination', async ({ workspaceId }) => ({
    totals: await finance.totalPayableByDestination(workspaceId),
  }));

  registry.register('finance_customer_financial_summary', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    return finance.customerFinancialSummary(workspaceId, partyId);
  });

  registry.register('finance_gold_gate', async ({ workspaceId }) => finance.goldGateSummary(workspaceId));
}
