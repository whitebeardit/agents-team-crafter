import { describe, expect, it } from '@jest/globals';
import {
  formatCrmDirectReadResponse,
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
