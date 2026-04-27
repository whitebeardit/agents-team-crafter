import { describe, expect, it } from '@jest/globals';
import {
  formatCrmDirectReadResponse,
  isCompositeOperationalMessage,
  isMaxTurnsExceededOutput,
  parseCrmDirectReadIntent,
} from './coordinator-orchestrator.service.js';

describe('coordinator-orchestrator CRM direct read routing (Loop 138)', () => {
  it('routes explicit list-all customers message to crm_list_parties with empty query', () => {
    const intent = parseCrmDirectReadIntent('liste todos os clientes cadastrados');
    expect(intent).toEqual({
      actionId: 'crm_list_parties',
      input: { query: '', roles: ['customer'] },
      reason: 'list_all_customers',
    });
  });

  it('routes search by email directly to crm_find_party', () => {
    const intent = parseCrmDirectReadIntent('buscar cliente pelo e-mail maria@empresa.com');
    expect(intent).toEqual({
      actionId: 'crm_find_party',
      input: { email: 'maria@empresa.com' },
      reason: 'find_customer_by_identifier',
    });
  });

  it('returns null when message is not CRM-related', () => {
    const intent = parseCrmDirectReadIntent('qual o clima em Lisboa?');
    expect(intent).toBeNull();
  });

  it('returns null for composite operational intent (packages/scheduling) even with phone + party-id jargon', () => {
    expect(
      parseCrmDirectReadIntent(
        'Mesmo paciente celular +55 11 98888-7766. Registra uma venda de pacote com 4 sessões. Não quero party-id, só o número.',
      ),
    ).toBeNull();
    expect(isCompositeOperationalMessage('registra uma venda de pacote')).toBe(true);
  });

  it('returns null when user mentions party-id jargon but asks to schedule (no false CRM-only route)', () => {
    expect(
      parseCrmDirectReadIntent(
        'Preciso agendar consulta para o cliente do celular +55 11 91111-2222. Sem party-id.',
      ),
    ).toBeNull();
  });

  it('still routes simple phone lookup when message is CRM-only', () => {
    const intent = parseCrmDirectReadIntent('buscar cliente pelo celular +5511999998888');
    expect(intent).toEqual({
      actionId: 'crm_find_party',
      input: { phone: '+5511999998888' },
      reason: 'find_customer_by_identifier',
    });
  });

  it('does not treat party-id jargon as mentioning customer when stripped', () => {
    const intent = parseCrmDirectReadIntent(
      'Qual o cadastro associado a party-id? telefone +55 11 92222-3333',
    );
    expect(intent).toBeNull();
  });

  it('allows find by paciente + telefone when not composite', () => {
    const intent = parseCrmDirectReadIntent(
      'encontrar paciente com telefone +5511987654321',
    );
    expect(intent).toEqual({
      actionId: 'crm_find_party',
      input: { phone: '+5511987654321' },
      reason: 'find_customer_by_identifier',
    });
  });

  it('formats list response with readable lines', () => {
    const text = formatCrmDirectReadResponse('crm_list_parties', {
      parties: [
        { id: 'p1', displayName: 'Maria', email: 'maria@empresa.com' },
        { id: 'p2', displayName: 'João', phone: '+351910000000' },
      ],
    });
    expect(text).toContain('Encontrei 2 cliente(s) cadastrados');
    expect(text).toContain('1. Maria · id: p1 · email: maria@empresa.com');
    expect(text).toContain('2. João · id: p2 · telefone: +351910000000');
  });

  it('formats empty find response with useful fallback', () => {
    const text = formatCrmDirectReadResponse('crm_find_party', { parties: [] });
    expect(text).toBe('Não encontrei cliente com esse identificador.');
  });

  it('detects max-turns exceeded output robustly', () => {
    expect(isMaxTurnsExceededOutput('Erro ao executar coordenador: Max turns (10) exceeded')).toBe(true);
    expect(isMaxTurnsExceededOutput('max turns (5) exceeded')).toBe(true);
    expect(isMaxTurnsExceededOutput('timeout upstream')).toBe(false);
  });
});
