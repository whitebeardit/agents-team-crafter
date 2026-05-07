import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  assertSpecialistsExclusiveCatalogTools,
  getSpecialistsCatalogToolConflicts,
} from './planner-specialist-catalog-uniqueness.js';

describe('assertSpecialistsExclusiveCatalogTools', () => {
  it('nao lanca quando especialistas tem conjuntos disjuntos de IDs exclusivos', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'coordinator', name: 'C', catalogTools: ['web_search', 'calendar_access'] },
        { role: 'specialist', name: 'A', catalogTools: ['calendar_access'] },
        { role: 'specialist', name: 'B', catalogTools: ['file_search'] },
      ]),
    ).not.toThrow();
  });

  it('lanca quando dois especialistas partilham o mesmo ID exclusivo', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'specialist', name: 'Primeiro', catalogTools: ['calendar_access', 'web_search'] },
        { role: 'specialist', name: 'Segundo', catalogTools: ['calendar_access'] },
      ]),
    ).toThrow(AppError);
  });

  it('ignora coordenador com mesmo ID que especialista', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'coordinator', name: 'C', catalogTools: ['calendar_access'] },
        { role: 'specialist', name: 'S', catalogTools: ['calendar_access'] },
      ]),
    ).not.toThrow();
  });
});

describe('getSpecialistsCatalogToolConflicts', () => {
  it('retorna colisoes com nomes dos especialistas', () => {
    const c = getSpecialistsCatalogToolConflicts([
      { role: 'specialist', name: 'A', catalogTools: ['calendar_access'] },
      { role: 'specialist', name: 'B', catalogTools: ['calendar_access'] },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]?.toolId).toBe('calendar_access');
    expect(c[0]?.specialistNames.sort()).toEqual(['A', 'B'].sort());
  });

  it('permite internal_actions em especialistas diferentes quando dominios usam actions de negocio', () => {
    expect(
      getSpecialistsCatalogToolConflicts([
        { role: 'specialist', name: 'CRM', catalogTools: ['internal_actions'] },
        { role: 'specialist', name: 'Financeiro', catalogTools: ['internal_actions'] },
      ]),
    ).toHaveLength(0);
  });

  it('retorna vazio quando conjuntos sao disjuntos', () => {
    expect(
      getSpecialistsCatalogToolConflicts([
        { role: 'specialist', name: 'A', catalogTools: ['calendar_access'] },
        { role: 'specialist', name: 'B', catalogTools: ['file_search'] },
      ]),
    ).toHaveLength(0);
  });
});
