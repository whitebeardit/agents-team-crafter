import { describe, expect, it } from '@jest/globals';
import {
  DOMAIN_CAPABILITY_DEFINITIONS,
  listDomainCapabilities,
  resolveDomainCapabilitySelection,
} from './domain-capability-registry.js';

describe('domain-capability-registry', () => {
  it('lista dominios canonicos com actions diretas', () => {
    const ids = listDomainCapabilities().map((domain) => domain.id);
    expect(ids).toContain('crm');
    expect(ids).toContain('clinical');
    expect(ids).toContain('finance');
    expect(DOMAIN_CAPABILITY_DEFINITIONS.every((domain) => domain.actionIds.length > 0)).toBe(true);
  });

  it('resolve dependencias transitivas de dominios clinicos', () => {
    const resolution = resolveDomainCapabilitySelection(['clinical']);
    expect(resolution.domainIds).toEqual(expect.arrayContaining(['clinical', 'crm', 'care', 'scheduling']));
    expect(resolution.actionIds).toEqual(expect.arrayContaining(['clinical_create_anamnesis', 'crm_create_party']));
    expect(resolution.catalogTools).toEqual(expect.arrayContaining(['internal_actions', 'calendar_access']));
    expect(resolution.dependencies.domainIds).toEqual(expect.arrayContaining(['crm', 'care', 'scheduling']));
  });

  it('deduplica clinic_ops e dominios dependentes', () => {
    const resolution = resolveDomainCapabilitySelection(['clinic_ops', 'finance']);
    expect(resolution.domainIds.filter((id) => id === 'finance')).toHaveLength(1);
    expect(resolution.actionIds.filter((id) => id === 'finance_create_receivable')).toHaveLength(1);
    expect(resolution.actionIds).toContain('clinic_get_patient_full_snapshot');
  });
});

