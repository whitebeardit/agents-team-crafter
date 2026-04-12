import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../../shared/errors/app-error.js';
import { assertSpecialistsExclusiveCatalogTools } from './planner-specialist-catalog-uniqueness.js';

describe('assertSpecialistsExclusiveCatalogTools', () => {
  it('nao lanca quando especialistas tem conjuntos disjuntos de IDs exclusivos', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'coordinator', name: 'C', catalogTools: ['web_search', 'database_query'] },
        { role: 'specialist', name: 'A', catalogTools: ['database_query'] },
        { role: 'specialist', name: 'B', catalogTools: ['calendar_access'] },
      ]),
    ).not.toThrow();
  });

  it('lanca quando dois especialistas partilham o mesmo ID exclusivo', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'specialist', name: 'Primeiro', catalogTools: ['database_query', 'web_search'] },
        { role: 'specialist', name: 'Segundo', catalogTools: ['database_query'] },
      ]),
    ).toThrow(AppError);
  });

  it('ignora coordenador com mesmo ID que especialista', () => {
    expect(() =>
      assertSpecialistsExclusiveCatalogTools([
        { role: 'coordinator', name: 'C', catalogTools: ['database_query'] },
        { role: 'specialist', name: 'S', catalogTools: ['database_query'] },
      ]),
    ).not.toThrow();
  });
});
