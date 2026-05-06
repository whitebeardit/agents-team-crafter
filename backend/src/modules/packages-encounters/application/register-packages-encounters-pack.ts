import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import { resolvePartyIdFromPartyOrPhone } from '../../crm/application/resolve-party-id-from-input.js';
import type { PackageSaleRepository } from '../infra/package-sale.repository.js';
import type { PackageProductRepository } from '../infra/package-product.repository.js';
import type { EncounterRepository } from '../infra/encounter.repository.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import type { PackageConsumptionRepository } from '../infra/package-consumption.repository.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export function registerPackagesEncountersPack(
  registry: BusinessToolRegistry,
  packages: PackageSaleRepository,
  encounters: EncounterRepository,
  parties: PartyRepository,
  careSubjects: CareSubjectRepository,
  consumptions: PackageConsumptionRepository,
  packageProducts: PackageProductRepository,
): void {
  registry.register('package_sell_to_party', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
    const productSlugRaw = typeof data.productSlug === 'string' ? data.productSlug.trim() : '';
    let packageName = typeof data.packageName === 'string' ? data.packageName.trim() : '';
    let unitsTotal = Number(data.unitsTotal);
    let packageProductId: string | undefined;
    let productSlugSnapshot: string | undefined;
    let priceCentsAtSale: number | undefined;

    if (productSlugRaw) {
      const product = await packageProducts.findBySlug(workspaceId, productSlugRaw);
      if (!product) throw new Error(`Produto de pacote nao encontrado: ${productSlugRaw}`);
      packageName = product.displayName;
      unitsTotal = product.units;
      packageProductId = product.id;
      productSlugSnapshot = product.slug;
      priceCentsAtSale = product.priceCents;
    }

    if (!packageName || Number.isNaN(unitsTotal) || unitsTotal < 1) {
      throw new Error('Informe productSlug (catalogo) ou packageName e unitsTotal validos');
    }
    return packages.create(workspaceId, {
      partyId,
      packageName,
      unitsTotal,
      packageProductId,
      productSlug: productSlugSnapshot,
      priceCentsAtSale,
      teamContext,
      correlationId,
    });
  });

  registry.register('package_catalog_upsert', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const slug = typeof data.slug === 'string' ? data.slug.trim().toLowerCase() : '';
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
    const units = Number(data.units);
    const priceCents =
      data.priceCents === undefined || data.priceCents === null
        ? undefined
        : Number(data.priceCents);
    if (!slug || !displayName || Number.isNaN(units) || units < 1) {
      throw new Error('slug, displayName e units validos obrigatorios');
    }
    if (priceCents !== undefined && (Number.isNaN(priceCents) || priceCents < 0)) {
      throw new Error('priceCents invalido');
    }
    return packageProducts.upsert(workspaceId, { slug, displayName, units, priceCents });
  });

  registry.register('package_catalog_list', async ({ workspaceId }) => {
    return { products: await packageProducts.listByWorkspace(workspaceId) };
  });

  registry.register('package_get_balance', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : '';
    if (!packageSaleId) throw new Error('packageSaleId obrigatorio');
    const b = await packages.getBalance(workspaceId, packageSaleId);
    if (!b) throw new Error('Pacote nao encontrado');
    return b;
  });

  registry.register('package_list_by_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
    const sales = await packages.listByParty(workspaceId, partyId);
    const eligibleSales = sales.filter((sale) => sale.remaining > 0);
    return {
      partyId,
      packageSales: sales,
      eligible: eligibleSales.length > 0,
      eligiblePackageSaleIds: eligibleSales.map((sale) => sale.id),
      ineligibleReason: eligibleSales.length > 0 ? null : 'NO_ELIGIBLE_PACKAGE_FOR_PARTY',
    };
  });

  registry.register('attendance_register_session', async ({ workspaceId, input, teamContext, correlationId }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : undefined;
    if (packageSaleId) {
      const sale = await packages.findById(workspaceId, packageSaleId);
      if (!sale) throw new Error('packageSale nao encontrado');
      if (sale.partyId !== partyId) throw new Error('packageSale deve pertencer ao mesmo partyId');
      const consumed = await packages.consumeUnit(workspaceId, packageSaleId);
      if (!consumed) throw new Error('Nao foi possivel consumir unidade do pacote');
    }
    return encounters.create(workspaceId, {
      partyId,
      packageSaleId,
      notes: typeof data.notes === 'string' ? data.notes : '',
      durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : Number(data.durationMinutes) || 0,
      teamContext,
      correlationId,
    });
  });

  /**
   * Consome exatamente uma unidade de pacote de forma idempotente por encounter.
   * Se a combinação {workspaceId, packageSaleId, encounterId} já foi consumida, não consome de novo.
   */
  registry.register('package_consume_unit_once', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const packageSaleId = typeof data.packageSaleId === 'string' ? data.packageSaleId : '';
    const encounterId = typeof data.encounterId === 'string' ? data.encounterId : '';
    const appointmentId = typeof data.appointmentId === 'string' ? data.appointmentId : undefined;
    if (!packageSaleId) throw new Error('packageSaleId obrigatorio');
    if (!encounterId) throw new Error('encounterId obrigatorio');

    const sale = await packages.findById(workspaceId, packageSaleId);
    if (!sale) throw new Error('packageSale nao encontrado');

    const encounter = await encounters.findById(workspaceId, encounterId);
    if (!encounter) throw new Error('encounter nao encontrado');
    if (encounter.partyId !== sale.partyId) {
      throw new Error('encounter deve pertencer ao mesmo partyId que a venda do pacote');
    }

    const created = await consumptions.createOnce(workspaceId, {
      packageSaleId,
      partyId: sale.partyId,
      encounterId,
      appointmentId,
      units: 1,
    });
    let consumed: { id: string; remaining: number; unitsTotal: number; unitsUsed: number } | null = null;
    if (created.created) {
      consumed = await packages.consumeUnit(workspaceId, packageSaleId);
      if (!consumed) throw new Error('Nao foi possivel consumir unidade do pacote');
    } else {
      consumed = await packages.getBalance(workspaceId, packageSaleId);
    }
    const payload = {
      ok: true,
      packageSaleId,
      encounterId,
      consumptionId: created.id,
      alreadyConsumed: !created.created,
      balance: consumed,
    };
    logger.info(
      {
        kind: 'clinic_action_runtime',
        event: 'clinic.package.unit_consumed',
        workspaceId,
        action: 'package_consume_unit_once',
        verificationStatus: 'success',
        packageSaleId,
        encounterId,
      },
      'clinic_action_runtime',
    );
    return payload;
  });

  registry.register('attendance_list_by_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
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
    const partyId = await resolvePartyIdFromPartyOrPhone({
      workspaceId,
      parties,
      data,
      requireIdentity: true,
    });
    if (!partyId) throw new Error('partyId ou phone obrigatorio');
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
