import type { PackageSaleRepository } from '../../packages-encounters/infra/package-sale.repository.js';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import { ClinicAmbiguityError } from '../domain/clinic-errors.js';

export type EligiblePackageResolution =
  | { kind: 'selected'; packageSaleId: string; reason: string }
  | { kind: 'none'; reason: string }
  | { kind: 'ambiguous'; reason: string; candidates: Array<{ id: string; packageName: string; remaining: number }> };

export class ClinicPackagePolicyService {
  constructor(
    private readonly packageSales: PackageSaleRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  private async allowUnpackagedSession(workspaceId: string): Promise<boolean> {
    const ws = await this.workspaces.findById(workspaceId);
    const settings = (ws?.settings ?? {}) as Record<string, unknown>;
    return settings.allowUnpackagedSession === true;
  }

  async resolveEligiblePackageSaleId(workspaceId: string, partyId: string): Promise<EligiblePackageResolution> {
    const sales = await this.packageSales.listByParty(workspaceId, partyId);
    const eligible = sales.filter((s) => s.remaining >= 1);

    if (eligible.length === 0) {
      if (await this.allowUnpackagedSession(workspaceId)) {
        return { kind: 'none', reason: 'workspace_allows_unpacked_session' };
      }
      return { kind: 'none', reason: 'no_eligible_package' };
    }
    if (eligible.length === 1) {
      return { kind: 'selected', packageSaleId: eligible[0]!.id, reason: 'single_eligible_package' };
    }
    return {
      kind: 'ambiguous',
      reason: 'multiple_eligible_packages',
      candidates: eligible.map((s) => ({ id: s.id, packageName: s.packageName, remaining: s.remaining })),
    };
  }

  async pickOrThrow(workspaceId: string, partyId: string): Promise<string | null> {
    const r = await this.resolveEligiblePackageSaleId(workspaceId, partyId);
    if (r.kind === 'selected') return r.packageSaleId;
    if (r.kind === 'none') return null;
    throw new ClinicAmbiguityError('Mais de um pacote elegível encontrado. Precisa desambiguar.', {
      candidates: r.candidates,
    });
  }
}

