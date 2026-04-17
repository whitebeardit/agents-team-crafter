import { describe, expect, it, jest } from '@jest/globals';
import { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { registerCarePack } from './register-care-pack.js';
import type { CareSubjectRepository } from '../infra/care-subject.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';

describe('registerCarePack — care_gold_gate', () => {
  it('exposes care_gold_gate with deterministic contract', async () => {
    const registry = new BusinessToolRegistry();
    const care = {
      goldGateSummary: jest.fn(async () => ({
        approved: false,
        evaluatedAt: '2026-04-14T00:00:00.000Z',
        criteria: [{ code: 'care_has_subjects', passed: false, detail: 'sem sujeitos' }],
        blockingCriteria: [{ code: 'care_has_subjects', passed: false, detail: 'sem sujeitos' }],
        snapshot: {
          totalSubjects: 0,
          subjectsWithNotes: 0,
          partiesWithSubjects: 0,
          avgSubjectsPerParty: 0,
          kinds: {},
        },
      })),
    } as unknown as CareSubjectRepository;

    registerCarePack(registry, care);
    const gate = registry.get('care_gold_gate');
    expect(gate).toBeDefined();
    const out = await gate!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: {},
    });
    expect(care.goldGateSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(out).toMatchObject({
      approved: false,
      criteria: expect.any(Array),
      blockingCriteria: expect.any(Array),
      snapshot: expect.any(Object),
    });
  });

  it('creates psych patient as Party + CareSubject via care_create_patient', async () => {
    const registry = new BusinessToolRegistry();
    const care = {
      create: jest.fn(async () => ({ id: 'subj-1', partyId: 'party-1', subjectKind: 'psych' })),
      goldGateSummary: jest.fn(async () => ({})),
    } as unknown as CareSubjectRepository;
    const parties = {
      create: jest.fn(async () => ({ id: 'party-1', displayName: 'Paciente Teste', roles: ['customer', 'patient'] })),
    } as unknown as PartyRepository;

    registerCarePack(registry, care, parties);
    const createPatient = registry.get('care_create_patient');
    expect(createPatient).toBeDefined();

    const out = await createPatient!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { name: 'Paciente Teste', email: 'paciente@teste.com', phone: '+351900000000' },
    });

    expect(parties.create).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      displayName: 'Paciente Teste',
      roles: ['customer', 'patient'],
      email: 'paciente@teste.com',
      phone: '+351900000000',
      notes: undefined,
    });
    expect(care.create).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      partyId: 'party-1',
      name: 'Paciente Teste',
      subjectKind: 'psych',
      notes: undefined,
    });
    expect(out).toMatchObject({
      party: { id: 'party-1' },
      subject: { id: 'subj-1', partyId: 'party-1', subjectKind: 'psych' },
    });
  });
});
