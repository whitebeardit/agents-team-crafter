import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { resolvePartyIdFromPartyOrPhone } from '../../crm/application/resolve-party-id-from-input.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { FinanceRepository } from '../infra/finance.repository.js';

export function registerFinancePack(
  registry: BusinessToolRegistry,
  finance: FinanceRepository,
  parties: PartyRepository,
): void {
  registry.register('finance_create_receivable', async ({ workspaceId, input, teamContext, correlationId, actorAgentId, actorRole }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    const amount = Number(data.amount);
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate : '';
    if (!partyId || Number.isNaN(amount) || !dueDate) throw new Error('partyId ou phone, amount e dueDate obrigatorios');
    const sourceEntity = typeof data.sourceEntity === 'string' ? data.sourceEntity.trim() : undefined;
    const sourceId = typeof data.sourceId === 'string' ? data.sourceId.trim() : undefined;
    return finance.createReceivable(workspaceId, {
      partyId,
      amount,
      dueDate,
      description: typeof data.description === 'string' ? data.description : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      teamContext,
      correlationId,
      actorAgentId,
      actorRole,
      ...(sourceEntity && sourceId ? { sourceEntity, sourceId } : {}),
    });
  });

  registry.register('finance_create_payable', async ({ workspaceId, input, teamContext, correlationId, actorAgentId, actorRole }) => {
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
      teamContext,
      correlationId,
      actorAgentId,
      actorRole,
    });
  });

  registry.register('finance_mark_receivable_paid', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const id = typeof data.receivableId === 'string' ? data.receivableId : '';
    if (!id) throw new Error('receivableId obrigatorio');
    const paymentNote = typeof data.paymentNote === 'string' ? data.paymentNote : undefined;
    const r = await finance.markReceivablePaid(workspaceId, id, { paymentNote });
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

  registry.register('finance_find_receivable_by_appointment', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId.trim() : '';
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    return finance.findReceivableByAppointmentId(workspaceId, appointmentId);
  });

  registry.register('finance_customer_financial_summary', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
    return finance.customerFinancialSummary(workspaceId, partyId);
  });

  registry.register('finance_gold_gate', async ({ workspaceId }) => finance.goldGateSummary(workspaceId));
}
