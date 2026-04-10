import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { IPartyUpdateOperation, PartyRepository } from '../infra/party.repository.js';

export function registerCrmPack(registry: BusinessToolRegistry, parties: PartyRepository): void {
  registry.register('crm_create_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const displayName = typeof data.displayName === 'string' ? data.displayName : '';
    if (!displayName.trim()) throw new Error('displayName obrigatorio');
    const roles = Array.isArray(data.roles)
      ? data.roles.filter((x): x is string => typeof x === 'string')
      : [];
    return parties.create(workspaceId, {
      displayName: displayName.trim(),
      roles,
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
    if (Object.keys(set).length === 0 && unset.length === 0) {
      throw new Error('Nenhum campo para atualizar');
    }
    const u = await parties.update(workspaceId, partyId, { set, unset });
    if (!u) throw new Error('Party nao encontrada');
    return u;
  });

  registry.register('crm_find_party', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const query = typeof data.query === 'string' ? data.query : '';
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
}
