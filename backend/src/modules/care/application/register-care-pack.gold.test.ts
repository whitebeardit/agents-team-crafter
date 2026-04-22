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

  it('resolves phone to partyId before care_create_subject execution', async () => {
    const registry = new BusinessToolRegistry();
    const care = {
      create: jest.fn(async () => ({ id: 'subj-2', partyId: 'party-by-phone', subjectKind: 'human' })),
    } as unknown as CareSubjectRepository;
    const parties = {
      findByEmailOrPhone: jest.fn(async () => [{ id: 'party-by-phone' }]),
      findById: jest.fn(async () => ({ id: 'party-by-phone' })),
    } as unknown as PartyRepository;

    registerCarePack(registry, care, parties);
    const createSubject = registry.get('care_create_subject');
    expect(createSubject).toBeDefined();

    await createSubject!({
      workspaceId: '507f1f77bcf86cd799439011',
      input: { phone: '+351900000000', name: 'Paciente via lookup', subjectKind: 'human' },
    });

    expect(parties.findByEmailOrPhone).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      phone: '+351900000000',
      limit: 3,
    });
    expect(care.create).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      partyId: 'party-by-phone',
      name: 'Paciente via lookup',
      subjectKind: 'human',
      notes: undefined,
    });
  });

  it('blocks care_create_subject when phone lookup is ambiguous', async () => {
    const registry = new BusinessToolRegistry();
    const care = { create: jest.fn() } as unknown as CareSubjectRepository;
    const parties = {
      findByEmailOrPhone: jest.fn(async () => [{ id: 'party-1' }, { id: 'party-2' }]),
      findById: jest.fn(),
    } as unknown as PartyRepository;
    registerCarePack(registry, care, parties);
    const createSubject = registry.get('care_create_subject');

    await expect(
      createSubject!({
        workspaceId: '507f1f77bcf86cd799439011',
        input: { phone: '+351900000000', name: 'Paciente B', subjectKind: 'human' },
      }),
    ).rejects.toThrow('Phone ambiguo no workspace');
    expect(care.create).not.toHaveBeenCalled();
  });

  it('blocks care_update_subject when informed partyId mismatches subject ownership', async () => {
    const registry = new BusinessToolRegistry();
    const care = {
      findById: jest.fn(async () => ({ id: 'subj-10', partyId: 'party-owner', subjectKind: 'psych' })),
      update: jest.fn(),
    } as unknown as CareSubjectRepository;
    const parties = {
      findById: jest.fn(async (_ws: string, partyId: string) => ({ id: partyId })),
    } as unknown as PartyRepository;
    registerCarePack(registry, care, parties);
    const updateSubject = registry.get('care_update_subject');

    await expect(
      updateSubject!({
        workspaceId: '507f1f77bcf86cd799439011',
        input: { subjectId: 'subj-10', partyId: 'party-other', notes: 'Atualizar nota' },
      }),
    ).rejects.toThrow('partyId informado nao corresponde ao ownership do subject');
    expect(care.update).not.toHaveBeenCalled();
  });
});
