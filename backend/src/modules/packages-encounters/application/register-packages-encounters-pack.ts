import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { PackageSaleRepository } from '../infra/package-sale.repository.js';
import type { EncounterRepository } from '../infra/encounter.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';

export function registerPackagesEncountersPack(
  registry: BusinessToolRegistry,
  packages: PackageSaleRepository,
  encounters: EncounterRepository,
  parties: PartyRepository,
  careSubjects: CareSubjectRepository,
): void {
  registry.register('package_sell_to_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    const packageName = typeof data.packageName === 'string' ? data.packageName : '';
    const unitsTotal = Number(data.unitsTotal);
    if (!partyId || !packageName.trim() || Number.isNaN(unitsTotal) || unitsTotal < 1) {
      throw new Error('partyId, packageName e unitsTotal validos obrigatorios');
    }
    return packages.create(workspaceId, { partyId, packageName: packageName.trim(), unitsTotal });
  });

  registry.register('package_get_balance', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : '';
    if (!packageSaleId) throw new Error('packageSaleId obrigatorio');
    const b = await packages.getBalance(workspaceId, packageSaleId);
    if (!b) throw new Error('Pacote nao encontrado');
    return b;
  });

  registry.register('attendance_register_session', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : undefined;
    if (packageSaleId) {
      const consumed = await packages.consumeUnit(workspaceId, packageSaleId);
      if (!consumed) throw new Error('Nao foi possivel consumir unidade do pacote');
    }
    return encounters.create(workspaceId, {
      partyId,
      packageSaleId,
      notes: typeof data.notes === 'string' ? data.notes : '',
      durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : Number(data.durationMinutes) || 0,
    });
  });

  registry.register('attendance_list_by_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    return { encounters: await encounters.listByParty(workspaceId, partyId) };
  });

  registry.register('attendance_list_by_package_sale', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : '';
    if (!packageSaleId) throw new Error('packageSaleId obrigatorio');
    return { encounters: await encounters.listByPackageSale(workspaceId, packageSaleId) };
  });

  registry.register('attendance_get_party_care_summary', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    const party = await parties.findById(workspaceId, partyId);
    const enc = await encounters.listByParty(workspaceId, partyId);
    const subs = await careSubjects.listByParty(workspaceId, partyId);
    return { party, encounters: enc, careSubjects: subs };
  });

  registry.register('packages_encounters_gold_gate', async ({ workspaceId }) => {
    const [salesSnapshot, encountersSnapshot] = await Promise.all([
      packages.goldGateSnapshot(workspaceId),
      encounters.goldGateSnapshot(workspaceId),
    ]);
    const criteria = [
      {
        code: 'packages_has_sales',
        label: 'Vendas de pacote registradas',
        passed: salesSnapshot.totalSales > 0,
        detail:
          salesSnapshot.totalSales > 0
            ? `Há ${salesSnapshot.totalSales} venda(s) de pacote registrada(s).`
            : 'Nenhuma venda de pacote registrada no momento.',
      },
      {
        code: 'packages_has_usage',
        label: 'Consumo de unidades em andamento',
        passed: salesSnapshot.unitsUsed > 0,
        detail:
          salesSnapshot.unitsUsed > 0
            ? `Há ${salesSnapshot.unitsUsed} unidade(s) consumida(s).`
            : 'Ainda não há consumo de unidades de pacotes.',
      },
      {
        code: 'encounters_has_sessions',
        label: 'Sessões/atendimentos registrados',
        passed: encountersSnapshot.totalEncounters > 0,
        detail:
          encountersSnapshot.totalEncounters > 0
            ? `Há ${encountersSnapshot.totalEncounters} atendimento(s) registrado(s).`
            : 'Nenhum atendimento registrado no momento.',
      },
      {
        code: 'encounters_linked_to_packages',
        label: 'Atendimentos vinculados a pacote',
        passed: encountersSnapshot.packageLinkedEncounters > 0,
        detail:
          encountersSnapshot.packageLinkedEncounters > 0
            ? 'Existem atendimentos vinculados às vendas de pacote.'
            : 'Ainda não há atendimentos vinculados a pacotes.',
      },
    ];
    const blockingCriteria = criteria.filter((criterion) => !criterion.passed);
    return {
      approved: blockingCriteria.length === 0,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        ...salesSnapshot,
        ...encountersSnapshot,
      },
    };
  });
}
