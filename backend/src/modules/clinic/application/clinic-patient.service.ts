import { normalizePartyPhone } from '../../crm/domain/normalize-party-phone.js';
import type { IPartyUpdateOperation, PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';

export type ClinicPatientResolution = {
  partyId: string;
  careSubjectId: string;
  phoneDigits?: string;
  party: {
    id: string;
    displayName: string;
    phone?: string;
    email?: string;
    status?: string;
    roles?: string[];
  };
};

export class ClinicPatientService {
  constructor(
    private readonly parties: PartyRepository,
    private readonly careSubjects: CareSubjectRepository,
  ) {}

  normalizePhoneDigits(raw: string | undefined | null): string | undefined {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) return undefined;
    const digits = normalizePartyPhone(v);
    return digits || undefined;
  }

  async findOrCreatePsychPatientByPhone(
    workspaceId: string,
    input: {
      phone: string;
      name?: string;
      email?: string | null;
      notes?: string | null;
    },
  ): Promise<ClinicPatientResolution> {
    const phoneDigits = this.normalizePhoneDigits(input.phone);
    if (!phoneDigits) throw new Error('phone obrigatorio');

    const found = await this.parties.findByEmailOrPhone(workspaceId, { phone: phoneDigits, limit: 5 });
    if (found.length > 1) {
      throw new Error('telefone ambiguo no CRM (mais de um cadastro)');
    }
    let party = found[0];
    if (!party) {
      const displayName = (input.name ?? '').trim();
      if (!displayName) throw new Error('name obrigatorio para criar paciente novo');
      party = await this.parties.create(workspaceId, {
        displayName,
        phone: phoneDigits,
        email: typeof input.email === 'string' ? input.email : undefined,
        notes: typeof input.notes === 'string' ? input.notes : undefined,
        roles: ['customer', 'patient'],
        status: 'active',
      });
    } else {
      // Best-effort enrichment: if caller sent name/email/notes and record lacks it, fill.
      const set: IPartyUpdateOperation['set'] = {};
      const unset: Array<'email' | 'phone' | 'notes'> = [];
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (name && party.displayName !== name) {
        set.displayName = name;
      }
      if (typeof input.email === 'string' && input.email.trim() && !party.email) {
        set.email = input.email.trim();
      }
      if (typeof input.notes === 'string' && input.notes.trim() && !party.notes) {
        set.notes = input.notes.trim();
      }
      if (!party.phone && phoneDigits) {
        set.phone = phoneDigits;
      }
      const roles = Array.isArray(party.roles) ? party.roles : [];
      const merged = Array.from(new Set([...roles, 'customer', 'patient']));
      if (merged.length !== roles.length) {
        set.roles = merged;
      }
      if (Object.keys(set).length > 0 || unset.length > 0) {
        const updated = await this.parties.update(workspaceId, party.id, {
          set,
          unset,
        });
        if (updated) party = updated;
      }
    }

    const subjects = await this.careSubjects.listByParty(workspaceId, party.id, 50);
    const psych = subjects.find((s) => s.subjectKind === 'psych');
    const careSubject =
      psych ??
      (await this.careSubjects.create(workspaceId, {
        partyId: party.id,
        name: party.displayName,
        subjectKind: 'psych',
      }));

    return {
      partyId: party.id,
      careSubjectId: careSubject.id,
      phoneDigits,
      party: {
        id: party.id,
        displayName: party.displayName,
        phone: party.phone,
        email: party.email,
        status: party.status,
        roles: party.roles,
      },
    };
  }
}

