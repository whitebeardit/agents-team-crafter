import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { IPartyUpdateOperation, PartyRepository } from '../infra/party.repository.js';

export function registerCrmPack(registry: BusinessToolRegistry, parties: PartyRepository): void {
  registry.register('crm_create_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const candidateName =
      typeof data.name === 'string'
        ? data.name
        : typeof data.nome === 'string'
          ? data.nome
          : typeof data['nome completo'] === 'string'
            ? data['nome completo']
            : typeof data.nomeCompleto === 'string'
              ? data.nomeCompleto
              : typeof data.fullName === 'string'
                ? data.fullName
                : typeof data.displayName === 'string'
                  ? data.displayName
                  : '';
    const displayName = candidateName.trim();
    if (!displayName.trim()) throw new Error('Nome do cliente obrigatorio');
    let roles = Array.isArray(data.roles)
      ? data.roles.filter((x): x is string => typeof x === 'string')
      : [];
    if (roles.length === 0) roles = ['customer'];
    const rawStatus = typeof data.status === 'string' ? data.status : '';
    const status =
      rawStatus === 'inactive' ? 'inactive' : rawStatus === 'active' ? 'active' : undefined;
    return parties.create(workspaceId, {
      displayName: displayName.trim(),
      roles,
      status,
      email: typeof data.email === 'string' ? data.email : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    });
  });

  registry.register('crm_update_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    const set: IPartyUpdateOperation['set'] = {};
    const unset: IPartyUpdateOperation['unset'] = [];
    if (typeof data.displayName === 'string') set.displayName = data.displayName.trim();
    if (Array.isArray(data.roles)) set.roles = data.roles.filter((x): x is string => typeof x === 'string');
    if (typeof data.email === 'string') {
      const t = data.email.trim();
      if (t) set.email = t;
      else unset.push('email');
    }
    if (typeof data.phone === 'string') {
      const t = data.phone.trim();
      if (t) set.phone = t;
      else unset.push('phone');
    }
    if (typeof data.notes === 'string') {
      const t = data.notes.trim();
      if (t) set.notes = t;
      else unset.push('notes');
    }
    if (data.status === 'active' || data.status === 'inactive') {
      set.status = data.status;
    }
    if (Object.keys(set).length === 0 && unset.length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }
    const u = await parties.update(workspaceId, partyId, { set, unset });
    if (!u) throw new Error('Party nao encontrada');
    return u;
  });

  registry.register('crm_find_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId.trim() : '';
    if (partyId) {
      const one = await parties.findById(workspaceId, partyId);
      return { parties: one ? [one] : [] };
    }
    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
    const query = typeof data.query === 'string' ? data.query.trim() : '';
    if (email || phone) {
      const byIdentifier = await parties.findByEmailOrPhone(workspaceId, { email, phone });
      if (byIdentifier.length > 0 || !query) return { parties: byIdentifier };
    }
    if (!query) {
      throw new Error('Informe partyId, email, phone ou query para localizar cliente');
    }
    return { parties: await parties.findByQuery(workspaceId, query) };
  });

  registry.register('crm_get_party_summary', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId : '';
    if (!partyId) throw new Error('partyId obrigatorio');
    const p = await parties.findById(workspaceId, partyId);
    if (!p) throw new Error('Party nao encontrada');
    return { summary: p };
  });

  registry.register('crm_list_parties_by_role', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const role = typeof data.role === 'string' ? data.role : '';
    if (!role.trim()) throw new Error('role obrigatorio');
    return { parties: await parties.listByRole(workspaceId, role) };
  });

  registry.register('crm_list_parties', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const query = typeof data.query === 'string' ? data.query.trim() : '';
    const roles = Array.isArray(data.roles)
      ? data.roles.filter((x): x is string => typeof x === 'string')
      : undefined;
    const st = typeof data.status === 'string' ? data.status : '';
    const status =
      st === 'active' || st === 'inactive' ? (st as 'active' | 'inactive') : undefined;
    const limit = typeof data.limit === 'number' && Number.isFinite(data.limit) ? data.limit : undefined;
    return {
      parties: await parties.listParties(workspaceId, {
        query,
        roles,
        status,
        limit,
      }),
    };
  });
}
