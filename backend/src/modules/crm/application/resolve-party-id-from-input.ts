import type { PartyRepository } from '../infra/party.repository.js';

function readNonEmptyString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve canonical party id from either `partyId`-style field or CRM `phone` lookup.
 * Mirrors ownership rules used in Care (single match required).
 */
export async function resolvePartyIdFromPartyOrPhone(params: {
  workspaceId: string;
  parties: PartyRepository;
  data: Record<string, unknown>;
  /** JSON field for direct id (default partyId). */
  idKey?: 'partyId' | 'destinationPartyId';
  requireIdentity: boolean;
}): Promise<string | undefined> {
  const idKey = params.idKey ?? 'partyId';
  const directId = readNonEmptyString(params.data, idKey);
  const phone = readNonEmptyString(params.data, 'phone');

  if (!params.requireIdentity && !directId && !phone) return undefined;

  let resolvedByPhoneId: string | undefined;
  if (phone) {
    const matches = await params.parties.findByEmailOrPhone(params.workspaceId, {
      phone,
      limit: 5,
    });
    if (matches.length === 0) {
      throw new Error('Telefone nao encontrado no CRM para este workspace');
    }
    if (matches.length > 1) {
      throw new Error('Telefone ambiguo: varias parties com o mesmo numero; use partyId ou desambiguar no CRM');
    }
    resolvedByPhoneId = matches[0]?.id;
  }

  const effectiveId = directId ?? resolvedByPhoneId;
  if (params.requireIdentity && !effectiveId) {
    throw new Error('partyId ou telefone (phone) obrigatorio');
  }
  if (!effectiveId) return undefined;

  if (directId && resolvedByPhoneId && directId !== resolvedByPhoneId) {
    throw new Error('partyId e telefone referenciam clientes diferentes');
  }

  const party = await params.parties.findById(params.workspaceId, effectiveId);
  if (!party) throw new Error('Party nao encontrada');
  return party.id;
}
