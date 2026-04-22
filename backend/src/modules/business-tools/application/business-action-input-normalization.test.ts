import { describe, expect, it } from '@jest/globals';
import {
  getActionNormalizationSafetyClass,
  normalizeBusinessActionInput,
} from './business-action-input-normalization.js';

describe('normalizeBusinessActionInput (Loop 98.6)', () => {
  it('normalizes crm_create_party name, email and phone aliases', () => {
    const normalized = normalizeBusinessActionInput('crm_create_party', {
      'nome completo': 'Rita Davila',
      mail: 'rita@gmail.com',
      telefone: '+351900000000',
    }) as Record<string, unknown>;

    expect(normalized.name).toBe('Rita Davila');
    expect(normalized.email).toBe('rita@gmail.com');
    expect(normalized.phone).toBe('+351900000000');
  });

  it('normalizes crm_create_party name alias into displayName', () => {
    const normalized = normalizeBusinessActionInput('crm_create_party', {
      name: 'Cliente Natural',
    }) as Record<string, unknown>;

    expect(normalized.name).toBe('Cliente Natural');
  });

  it('normalizes crm_delete_party partyId aliases', () => {
    const normalized = normalizeBusinessActionInput('crm_delete_party', {
      customerId: 'party-99',
    }) as Record<string, unknown>;
    expect(normalized.partyId).toBe('party-99');
    expect(getActionNormalizationSafetyClass('crm_delete_party')).toBe('A');
  });

  it('normalizes crm_update_party displayName aliases', () => {
    const normalized = normalizeBusinessActionInput('crm_update_party', {
      partyId: 'p-1',
      full_name: 'Cliente Atualizado',
    }) as Record<string, unknown>;

    expect(normalized.displayName).toBe('Cliente Atualizado');
    expect(normalized.partyId).toBe('p-1');
  });

  it('keeps payload unchanged for actions without configured normalization', () => {
    const input = { query: 'abc' };
    const normalized = normalizeBusinessActionInput('finance_total_payable_by_destination', input);
    expect(normalized).toBe(input);
  });

  it('returns non-object inputs unchanged', () => {
    expect(normalizeBusinessActionInput('crm_create_party', 'x')).toBe('x');
    expect(normalizeBusinessActionInput('crm_create_party', null)).toBeNull();
  });

  it('does not auto-normalize class B actions by default', () => {
    const input = { termo: 'maria' };
    const normalized = normalizeBusinessActionInput('crm_find_party', input) as Record<string, unknown>;
    expect(normalized).toEqual({ termo: 'maria' });
    expect(normalized.query).toBeUndefined();
  });

  it('normalizes finance payable aliases for destination and due date', () => {
    const normalized = normalizeBusinessActionInput('finance_create_payable', {
      supplierId: 'party-supplier-1',
      valor: '129.90',
      vencimento: '2026-04-30',
    }) as Record<string, unknown>;

    expect(normalized.destinationPartyId).toBe('party-supplier-1');
    expect(normalized.amount).toBe('129.90');
    expect(normalized.dueDate).toBe('2026-04-30');
  });

  it('normalizes finance aliases for pay statuses and customer summary', () => {
    const receivablePaid = normalizeBusinessActionInput('finance_mark_receivable_paid', {
      id: 'rec-1',
    }) as Record<string, unknown>;
    const payablePaid = normalizeBusinessActionInput('finance_mark_payable_paid', {
      tituloId: 'pay-9',
    }) as Record<string, unknown>;
    const customerSummary = normalizeBusinessActionInput('finance_customer_financial_summary', {
      clientId: 'party-77',
    }) as Record<string, unknown>;

    expect(receivablePaid.receivableId).toBe('rec-1');
    expect(payablePaid.payableId).toBe('pay-9');
    expect(customerSummary.partyId).toBe('party-77');
  });

  it('normalizes care subject aliases for id and kind', () => {
    const normalized = normalizeBusinessActionInput('care_create_subject', {
      ownerPartyId: 'party-care-1',
      nome: 'Paciente B',
      tipo: 'humano',
    }) as Record<string, unknown>;

    expect(normalized.partyId).toBe('party-care-1');
    expect(normalized.name).toBe('Paciente B');
    expect(normalized.subjectKind).toBe('human');
  });

  it('normalizes care phone aliases for subject create/update payloads', () => {
    const createNormalized = normalizeBusinessActionInput('care_create_subject', {
      celular: '+351900000001',
      name: 'Paciente D',
      subjectKind: 'human',
    }) as Record<string, unknown>;
    const updateNormalized = normalizeBusinessActionInput('care_update_subject', {
      subjectId: 'subj-11',
      telefone: '+351900000002',
    }) as Record<string, unknown>;

    expect(createNormalized.phone).toBe('+351900000001');
    expect(updateNormalized.phone).toBe('+351900000002');
  });

  it('normalizes patient creation aliases in care_create_patient', () => {
    const normalized = normalizeBusinessActionInput('care_create_patient', {
      nomeCompleto: 'Paciente C',
      mail: 'paciente.c@teste.com',
      celular: '+351900000000',
    }) as Record<string, unknown>;

    expect(normalized.name).toBe('Paciente C');
    expect(normalized.email).toBe('paciente.c@teste.com');
    expect(normalized.phone).toBe('+351900000000');
  });

  it('normalizes care subjectKind values in update payloads', () => {
    const normalized = normalizeBusinessActionInput('care_update_subject', {
      idSujeito: 'subj-1',
      kind: 'pet',
    }) as Record<string, unknown>;

    expect(normalized.subjectId).toBe('subj-1');
    expect(normalized.subjectKind).toBe('animal');
  });

  it('normalizes clinical aliases for subject and encounter ids', () => {
    const anamnesis = normalizeBusinessActionInput('clinical_create_anamnesis', {
      subjectId: 'subj-cl-1',
    }) as Record<string, unknown>;
    const openEncounter = normalizeBusinessActionInput('clinical_open_encounter', {
      clientId: 'party-10',
      idSujeito: 'subj-cl-2',
    }) as Record<string, unknown>;
    const closeEncounter = normalizeBusinessActionInput('clinical_close_encounter', {
      idEncontro: 'enc-77',
    }) as Record<string, unknown>;

    expect(anamnesis.careSubjectId).toBe('subj-cl-1');
    expect(openEncounter.partyId).toBe('party-10');
    expect(openEncounter.careSubjectId).toBe('subj-cl-2');
    expect(closeEncounter.encounterId).toBe('enc-77');
  });

  it('normalizes clinical evolution note aliases for body text', () => {
    const evolution = normalizeBusinessActionInput('clinical_add_evolution_note', {
      subjectId: 'subj-cl-9',
      evolutionNote: 'Paciente refere melhora importante nas últimas 24h.',
    }) as Record<string, unknown>;

    expect(evolution.careSubjectId).toBe('subj-cl-9');
    expect(evolution.body).toContain('melhora importante');
  });

  it('normalizes packages/encounters aliases for party and package sale identifiers', () => {
    const sellPackage = normalizeBusinessActionInput('package_sell_to_party', {
      customerId: 'party-44',
      nomePacote: 'Pacote Fisio',
      unitsTotal: 8,
    }) as Record<string, unknown>;
    const registerSession = normalizeBusinessActionInput('attendance_register_session', {
      clientId: 'party-44',
      idVendaPacote: 'sale-900',
    }) as Record<string, unknown>;

    expect(sellPackage.partyId).toBe('party-44');
    expect(sellPackage.packageName).toBe('Pacote Fisio');
    expect(registerSession.partyId).toBe('party-44');
    expect(registerSession.packageSaleId).toBe('sale-900');
  });

  it('normalizes services/sales aliases for service name, party and order ids', () => {
    const catalogItem = normalizeBusinessActionInput('service_catalog_create_item', {
      nomeServico: 'Acupuntura',
      unitPrice: 120,
    }) as Record<string, unknown>;
    const createOrder = normalizeBusinessActionInput('sales_create_service_order', {
      customerId: 'party-500',
      lines: [],
    }) as Record<string, unknown>;
    const markPaid = normalizeBusinessActionInput('sales_mark_order_paid', {
      idPedido: 'order-22',
    }) as Record<string, unknown>;

    expect(catalogItem.name).toBe('Acupuntura');
    expect(createOrder.partyId).toBe('party-500');
    expect(markPaid.orderId).toBe('order-22');
  });

  it('normalizes github ops aliases for owner/repo/comment fields', () => {
    const readPr = normalizeBusinessActionInput('github_read_pr', {
      repoOwner: 'whitebeardit',
      repository: 'agents-team-crafter',
      pullNumber: 10,
    }) as Record<string, unknown>;
    const commentPr = normalizeBusinessActionInput('github_comment_pr', {
      org: 'whitebeardit',
      repoName: 'agents-team-crafter',
      mensagem: 'LGTM com ajustes',
      pullNumber: 11,
    }) as Record<string, unknown>;

    expect(readPr.owner).toBe('whitebeardit');
    expect(readPr.repo).toBe('agents-team-crafter');
    expect(commentPr.owner).toBe('whitebeardit');
    expect(commentPr.repo).toBe('agents-team-crafter');
    expect(commentPr.body).toBe('LGTM com ajustes');
  });

  it('normalizes scheduling aliases for create/reschedule appointment', () => {
    const created = normalizeBusinessActionInput('schedule_create_appointment', {
      customerId: 'party-1',
      title: 'Consulta',
      startAt: '2026-05-01T10:00:00.000Z',
      endAt: '2026-05-01T11:00:00.000Z',
      reminderAt: '2026-05-01T09:30:00.000Z',
    }) as Record<string, unknown>;

    expect(created.partyId).toBe('party-1');
    expect(created.startsAt).toBe('2026-05-01T10:00:00.000Z');
    expect(created.endsAt).toBe('2026-05-01T11:00:00.000Z');
    expect(created.remindAt).toBe('2026-05-01T09:30:00.000Z');

    const rescheduled = normalizeBusinessActionInput('schedule_reschedule_appointment', {
      agendamentoId: 'appt-9',
      inicio: '2026-05-02T10:00:00.000Z',
      fim: '2026-05-02T11:30:00.000Z',
    }) as Record<string, unknown>;

    expect(rescheduled.appointmentId).toBe('appt-9');
    expect(rescheduled.startsAt).toBe('2026-05-02T10:00:00.000Z');
    expect(rescheduled.endsAt).toBe('2026-05-02T11:30:00.000Z');
  });

  it('normalizes scheduling day aliases for agenda and availability lookups', () => {
    const agenda = normalizeBusinessActionInput('schedule_list_agenda_by_date', {
      day: '2026-05-03',
    }) as Record<string, unknown>;
    const availability = normalizeBusinessActionInput('schedule_get_availability', {
      dia: '2026-05-04',
    }) as Record<string, unknown>;

    expect(agenda.date).toBe('2026-05-03');
    expect(availability.date).toBe('2026-05-04');
  });

  it('normalizes platform/admin aliases for ping and status overview', () => {
    const ping = normalizeBusinessActionInput('business.ping', {
      mensagem: 'ping de suporte',
    }) as Record<string, unknown>;
    const status = normalizeBusinessActionInput('platform_status_overview', {
      comHorario: 'true',
    }) as Record<string, unknown>;

    expect(ping.message).toBe('ping de suporte');
    expect(status.includeTimestamp).toBe('true');
  });

  it('exposes normalization safety class per action', () => {
    expect(getActionNormalizationSafetyClass('crm_create_party')).toBe('A');
    expect(getActionNormalizationSafetyClass('crm_find_party')).toBe('B');
    expect(getActionNormalizationSafetyClass('finance_create_payable')).toBe('A');
    expect(getActionNormalizationSafetyClass('finance_mark_payable_paid')).toBe('A');
    expect(getActionNormalizationSafetyClass('care_find_subject')).toBe('A');
    expect(getActionNormalizationSafetyClass('care_create_patient')).toBe('A');
    expect(getActionNormalizationSafetyClass('clinical_open_encounter')).toBe('A');
    expect(getActionNormalizationSafetyClass('attendance_register_session')).toBe('A');
    expect(getActionNormalizationSafetyClass('sales_mark_order_paid')).toBe('A');
    expect(getActionNormalizationSafetyClass('github_comment_pr')).toBe('A');
    expect(getActionNormalizationSafetyClass('schedule_create_appointment')).toBe('A');
    expect(getActionNormalizationSafetyClass('business.ping')).toBe('A');
    expect(getActionNormalizationSafetyClass('platform_status_overview')).toBe('A');
    expect(getActionNormalizationSafetyClass('finance_total_payable_by_destination')).toBe('C');
  });
});
