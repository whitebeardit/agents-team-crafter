import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';
import type { PartyRepository } from '../../crm/infra/party.repository.js';
import type { CareSubjectRepository } from '../../care/infra/care-subject.repository.js';
import type { WorkspaceRepository } from '../../workspaces/infra/workspace.repository.js';
import type { PackageSaleRepository } from '../../packages-encounters/infra/package-sale.repository.js';
import type { AppointmentRepository } from '../../scheduling/infra/appointment.repository.js';
import { ClinicPatientService } from './clinic-patient.service.js';
import { ClinicTimeService } from './clinic-time.service.js';
import type { ClinicActionResult } from '../domain/clinic-types.js';
import { ClinicPackagePolicyService } from './clinic-package-policy.service.js';
import { DateTime } from 'luxon';
import { ClinicAmbiguityError } from '../domain/clinic-errors.js';
import type { ClinicConversationStateRepository } from '../infra/clinic-conversation-state.repository.js';
import { observeClinicPackageUnitsRemaining } from '../../../app/metrics.js';

export function registerClinicPack(deps: {
  registry: BusinessToolRegistry;
  parties: PartyRepository;
  careSubjects: CareSubjectRepository;
  workspaces: WorkspaceRepository;
  packageSales: PackageSaleRepository;
  appointments: AppointmentRepository;
  conversationState: ClinicConversationStateRepository;
}): void {
  const patients = new ClinicPatientService(deps.parties, deps.careSubjects);
  const time = new ClinicTimeService(deps.workspaces);
  const packages = new ClinicPackagePolicyService(deps.packageSales, deps.workspaces);

  deps.registry.register('clinic_find_or_create_patient_by_phone', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const name = typeof data.name === 'string' ? data.name : undefined;
    const email =
      data.email === null ? null : typeof data.email === 'string' ? data.email : undefined;
    const notes =
      data.notes === null ? null : typeof data.notes === 'string' ? data.notes : undefined;

    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone, name, email, notes });
    const out: ClinicActionResult<{ partyId: string; careSubjectId: string }, typeof resolved> = {
      ok: true,
      action: 'clinic_find_or_create_patient_by_phone',
      write: { partyId: resolved.partyId, careSubjectId: resolved.careSubjectId },
      verification: { found: true, matches: true, snapshot: resolved },
    };
    if (teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
      });
    }
    return out;
  });

  deps.registry.register('clinic_create_patient', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const name = typeof data.name === 'string' ? data.name : '';
    const email =
      data.email === null ? null : typeof data.email === 'string' ? data.email : undefined;
    const notes =
      data.notes === null ? null : typeof data.notes === 'string' ? data.notes : undefined;

    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, {
      phone,
      name,
      email,
      notes,
    });
    const timezone = await time.resolveClinicTimezone(workspaceId);
    const out: ClinicActionResult<
      { partyId: string; careSubjectId: string; phoneDigits?: string; timezone: string },
      typeof resolved
    > = {
      ok: true,
      action: 'clinic_create_patient',
      write: {
        partyId: resolved.partyId,
        careSubjectId: resolved.careSubjectId,
        phoneDigits: resolved.phoneDigits,
        timezone,
      },
      verification: { found: true, matches: true, snapshot: resolved },
      userMessage: 'Paciente cadastrada com sucesso e prontuário clínico preparado.',
      nextSuggestedActions: ['clinic_sell_default_package', 'clinic_get_patient_full_snapshot'],
    };
    if (teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
        timezone,
      });
    }
    return out;
  });

  deps.registry.register('clinic_list_patient_packages', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const rows = await deps.packageSales.listByParty(workspaceId, resolved.partyId);
    rows.forEach((s) => observeClinicPackageUnitsRemaining(s.packageName ?? 'unknown', s.remaining));
    const summary = {
      totalSales: rows.length,
      withBalance: rows.filter((s) => s.remaining > 0).length,
      totalRemaining: rows.reduce((acc, s) => acc + Math.max(0, s.remaining), 0),
    };
    const out: ClinicActionResult<
      { partyId: string; items: typeof rows; summary: typeof summary },
      { partyId: string; items: typeof rows; summary: typeof summary }
    > = {
      ok: true,
      action: 'clinic_list_patient_packages',
      write: { partyId: resolved.partyId, items: rows, summary },
      verification: { found: true, matches: true, snapshot: { partyId: resolved.partyId, items: rows, summary } },
    };
    return out;
  });

  deps.registry.register('clinic_sell_default_package', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const packageName = typeof data.packageName === 'string' ? data.packageName : 'Pacote padrão';
    const unitsTotal = typeof data.unitsTotal === 'number' ? data.unitsTotal : Number(data.unitsTotal) || 1;
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const created = await deps.packageSales.create(workspaceId, {
      partyId: resolved.partyId,
      packageName,
      unitsTotal,
    });
    const list = await deps.packageSales.listByParty(workspaceId, resolved.partyId);
    const found = list.find((s) => s.id === created.id);
    const out: ClinicActionResult<{ packageSaleId: string }, { packageSaleId: string; packageSale?: typeof found }> =
      {
        ok: Boolean(found),
        action: 'clinic_sell_default_package',
        write: { packageSaleId: created.id },
        verification: {
          found: Boolean(found),
          matches: Boolean(found) && found?.unitsTotal === created.unitsTotal && found?.packageName === created.packageName,
          snapshot: { packageSaleId: created.id, packageSale: found },
        },
      };
    if (out.ok && out.verification.matches && teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
        currentPackageSaleId: created.id,
      });
    }
    return out;
  });

  deps.registry.register('clinic_get_eligible_package', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const r = await packages.resolveEligiblePackageSaleId(workspaceId, resolved.partyId);
    const out: ClinicActionResult<
      { partyId: string; resolution: typeof r },
      { partyId: string; resolution: typeof r }
    > = {
      ok: true,
      action: 'clinic_get_eligible_package',
      write: { partyId: resolved.partyId, resolution: r },
      verification: { found: true, matches: true, snapshot: { partyId: resolved.partyId, resolution: r } },
    };
    return out;
  });

  deps.registry.register('clinic_list_sessions_by_local_date', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const dateExpression = typeof data.dateExpression === 'string' ? data.dateExpression : '';
    const timezone =
      typeof data.timezone === 'string' && data.timezone.trim()
        ? data.timezone.trim()
        : await time.resolveClinicTimezone(workspaceId);
    const localDate = time.resolveLocalDateExpression(dateExpression, new Date(Date.now()), timezone);
    const rows = await deps.appointments.listByLocalDate(workspaceId, localDate, timezone);
    const out: ClinicActionResult<
      { localDate: string; timezone: string; appointments: typeof rows },
      { localDate: string; timezone: string; appointments: typeof rows }
    > = {
      ok: true,
      action: 'clinic_list_sessions_by_local_date',
      write: { localDate, timezone, appointments: rows },
      verification: { found: true, matches: true, snapshot: { localDate, timezone, appointments: rows } },
    };
    return out;
  });

  function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }

  deps.registry.register('clinic_schedule_session_by_phone', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const dateExpression = typeof data.dateExpression === 'string' ? data.dateExpression : '';
    const timeExpression = typeof data.timeExpression === 'string' ? data.timeExpression : '';
    const durationMinutes =
      typeof data.durationMinutes === 'number' ? data.durationMinutes : Number(data.durationMinutes) || 50;
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Consulta psicológica';

    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const timezone = await time.resolveClinicTimezone(workspaceId);
    const localDate = time.resolveLocalDateExpression(dateExpression, new Date(Date.now()), timezone);
    const range = time.buildAppointmentRange({
      localDate,
      localTime: timeExpression,
      durationMinutes,
      timezone,
    });

    const packageSaleId = await packages.pickOrThrow(workspaceId, resolved.partyId);
    if (!packageSaleId) {
      return {
        ok: false,
        action: 'clinic_schedule_session_by_phone',
        verification: { found: false, matches: false, warnings: ['Paciente sem pacote elegível.'] },
        userMessage: 'Não encontrei pacote com saldo para agendar essa sessão.',
      } satisfies ClinicActionResult;
    }

    const sameDay = await deps.appointments.listByLocalDate(workspaceId, localDate, timezone);
    const blocking = sameDay.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');
    const start = new Date(range.startsAt);
    const end = new Date(range.endsAt);
    const conflict = blocking.find((a) => rangesOverlap(start, end, new Date(a.startsAt), new Date(a.endsAt)));
    if (conflict) {
      return {
        ok: false,
        action: 'clinic_schedule_session_by_phone',
        verification: { found: true, matches: false, snapshot: { conflict } },
        userMessage: 'Há conflito de agenda nesse horário.',
      } satisfies ClinicActionResult;
    }

    const created = await deps.appointments.create(workspaceId, {
      partyId: resolved.partyId,
      careSubjectId: resolved.careSubjectId,
      packageSaleId,
      title,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      status: 'scheduled',
    });
    const verified = await deps.appointments.findById(workspaceId, created.id);
    const matches = Boolean(
      verified &&
        verified.partyId === resolved.partyId &&
        verified.careSubjectId === resolved.careSubjectId &&
        verified.packageSaleId === packageSaleId &&
        verified.startsAt === created.startsAt &&
        verified.endsAt === created.endsAt,
    );
    const out: ClinicActionResult<
      { appointmentId: string; timezone: string; localDate: string },
      { appointment?: typeof verified }
    > = {
      ok: Boolean(verified) && matches,
      action: 'clinic_schedule_session_by_phone',
      write: { appointmentId: created.id, timezone, localDate },
      verification: { found: Boolean(verified), matches, snapshot: { appointment: verified ?? undefined } },
    };
    if (out.ok && out.verification.matches && teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
        lastAppointmentId: created.id,
        currentPackageSaleId: packageSaleId,
        timezone,
      });
    }
    return out;
  });

  deps.registry.register('clinic_list_patient_sessions', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const limit = typeof data.limit === 'number' && Number.isFinite(data.limit) ? data.limit : 50;
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const timezone = await time.resolveClinicTimezone(workspaceId);
    const rows = await deps.appointments.listByParty(workspaceId, resolved.partyId, limit);
    const items = rows.map((a) => {
      const startsLocal = DateTime.fromISO(a.startsAt, { zone: 'utc' }).setZone(timezone);
      const endsLocal = DateTime.fromISO(a.endsAt, { zone: 'utc' }).setZone(timezone);
      return {
        ...a,
        local: {
          date: startsLocal.toISODate(),
          startsAt: startsLocal.toFormat('HH:mm'),
          endsAt: endsLocal.toFormat('HH:mm'),
          timezone,
        },
      };
    });
    const out: ClinicActionResult<{ partyId: string; items: typeof items }, { items: typeof items }> = {
      ok: true,
      action: 'clinic_list_patient_sessions',
      write: { partyId: resolved.partyId, items },
      verification: { found: true, matches: true, snapshot: { items } },
    };
    return out;
  });

  deps.registry.register('clinic_reschedule_session_by_context', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const explicitId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    const previousDateExpression = typeof data.previousDateExpression === 'string' ? data.previousDateExpression : '';
    const previousTimeExpression = typeof data.previousTimeExpression === 'string' ? data.previousTimeExpression : '';
    const newDateExpression = typeof data.newDateExpression === 'string' ? data.newDateExpression : '';
    const newTimeExpression = typeof data.newTimeExpression === 'string' ? data.newTimeExpression : '';

    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const timezone = await time.resolveClinicTimezone(workspaceId);

    let appointmentId = explicitId;
    if (!appointmentId) {
      if (teamContext?.teamId && conversationId?.trim()) {
        const state = await deps.conversationState.get(workspaceId, teamContext.teamId, conversationId);
        if (state?.lastAppointmentId) appointmentId = state.lastAppointmentId;
      }
    }
    if (!appointmentId) {
      const localPrevDate = time.resolveLocalDateExpression(previousDateExpression, new Date(Date.now()), timezone);
      const prevRange = time.buildAppointmentRange({
        localDate: localPrevDate,
        localTime: previousTimeExpression,
        durationMinutes: 1,
        timezone,
      });
      const list = await deps.appointments.listByParty(workspaceId, resolved.partyId, 200);
      const targetStarts = new Date(prevRange.startsAt).getTime();
      const candidates = list.filter((a) => Math.abs(new Date(a.startsAt).getTime() - targetStarts) <= 5 * 60 * 1000);
      if (candidates.length === 1) appointmentId = candidates[0]!.id;
      else if (candidates.length === 0) throw new Error('Nao encontrei agendamento para remarcar com esses dados.');
      else {
        throw new ClinicAmbiguityError('Encontrei mais de um agendamento compatível para remarcar.', {
          candidates: candidates.map((c) => ({ id: c.id, startsAt: c.startsAt, title: c.title, status: c.status })),
        });
      }
    }

    const localNewDate = time.resolveLocalDateExpression(newDateExpression, new Date(Date.now()), timezone);
    const newRange = time.buildAppointmentRange({
      localDate: localNewDate,
      localTime: newTimeExpression,
      durationMinutes: 50,
      timezone,
    });
    const updated = await deps.appointments.reschedule(workspaceId, appointmentId, {
      startsAt: newRange.startsAt,
      endsAt: newRange.endsAt,
    });
    const verified = await deps.appointments.findById(workspaceId, appointmentId);
    const matches = Boolean(
      verified && updated && verified.startsAt === updated.startsAt && verified.endsAt === updated.endsAt,
    );
    const out: ClinicActionResult<{ appointmentId: string }, { appointment?: typeof verified }> = {
      ok: Boolean(verified) && matches,
      action: 'clinic_reschedule_session_by_context',
      write: { appointmentId },
      verification: { found: Boolean(verified), matches, snapshot: { appointment: verified ?? undefined } },
    };
    if (out.ok && out.verification.matches && teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
        lastAppointmentId: appointmentId,
        timezone,
      });
    }
    return out;
  });

  deps.registry.register('clinic_cancel_session_by_context', async ({ workspaceId, input, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const explicitId = typeof data.appointmentId === 'string' ? data.appointmentId : '';
    const dateExpression = typeof data.dateExpression === 'string' ? data.dateExpression : '';
    const timeExpression = typeof data.timeExpression === 'string' ? data.timeExpression : '';
    const resolved = phone ? await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone }) : null;
    const timezone = await time.resolveClinicTimezone(workspaceId);
    let appointmentId = explicitId;
    if (!appointmentId && teamContext?.teamId && conversationId?.trim()) {
      const state = await deps.conversationState.get(workspaceId, teamContext.teamId, conversationId);
      if (state?.lastAppointmentId) appointmentId = state.lastAppointmentId;
    }
    if (!appointmentId && resolved && dateExpression && timeExpression) {
      const localDate = time.resolveLocalDateExpression(dateExpression, new Date(Date.now()), timezone);
      const targetRange = time.buildAppointmentRange({
        localDate,
        localTime: timeExpression,
        durationMinutes: 1,
        timezone,
      });
      const targetTs = new Date(targetRange.startsAt).getTime();
      const appts = await deps.appointments.listByParty(workspaceId, resolved.partyId, 200);
      const candidates = appts.filter((a) => Math.abs(new Date(a.startsAt).getTime() - targetTs) <= 5 * 60 * 1000);
      if (candidates.length === 1) appointmentId = candidates[0]!.id;
      else if (candidates.length > 1) {
        throw new ClinicAmbiguityError('Encontrei mais de um agendamento compatível para cancelar.', {
          candidates: candidates.map((c) => ({ id: c.id, startsAt: c.startsAt, title: c.title, status: c.status })),
        });
      }
    }
    if (!appointmentId) throw new Error('appointmentId obrigatorio');
    const next = await deps.appointments.updateStatus(workspaceId, appointmentId, 'cancelled');
    const verified = await deps.appointments.findById(workspaceId, appointmentId);
    const matches = Boolean(verified && verified.status === 'cancelled');
    const out: ClinicActionResult<{ appointmentId: string }, { appointment?: typeof verified }> = {
      ok: Boolean(next) && matches,
      action: 'clinic_cancel_session_by_context',
      write: { appointmentId },
      verification: { found: Boolean(verified), matches, snapshot: { appointment: verified ?? undefined } },
    };
    if (out.ok && out.verification.matches && teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        ...(resolved
          ? {
              currentPatient: {
                partyId: resolved.partyId,
                careSubjectId: resolved.careSubjectId,
                name: resolved.party.displayName,
                phone: resolved.party.phone ?? resolved.phoneDigits,
              },
            }
          : {}),
        lastAppointmentId: appointmentId,
        timezone,
      });
    }
    return out;
  });

  deps.registry.register('clinic_register_attendance_by_phone_and_time', async ({ workspaceId, input, correlationId, teamContext, conversationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const dateExpression = typeof data.dateExpression === 'string' ? data.dateExpression : '';
    const timeExpression = typeof data.timeExpression === 'string' ? data.timeExpression : '';
    const durationMinutes =
      typeof data.durationMinutes === 'number' ? data.durationMinutes : Number(data.durationMinutes) || 50;
    const chiefComplaint = typeof data.chiefComplaint === 'string' ? data.chiefComplaint.trim() : '';
    const evolutionNote = typeof data.evolutionNote === 'string' ? data.evolutionNote.trim() : '';

    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const timezone = await time.resolveClinicTimezone(workspaceId);
    const localDate = time.resolveLocalDateExpression(dateExpression, new Date(Date.now()), timezone);
    const targetRange = time.buildAppointmentRange({
      localDate,
      localTime: timeExpression,
      durationMinutes: 1,
      timezone,
    });
    const targetTs = new Date(targetRange.startsAt).getTime();

    const appts = await deps.appointments.listByParty(workspaceId, resolved.partyId, 200);
    const candidates = appts.filter((a) => Math.abs(new Date(a.startsAt).getTime() - targetTs) <= 30 * 60 * 1000);
    const chosen = candidates.find((a) => a.status !== 'cancelled' && a.status !== 'no_show') ?? candidates[0];
    if (!chosen) {
      return {
        ok: false,
        action: 'clinic_register_attendance_by_phone_and_time',
        verification: { found: false, matches: false },
        userMessage: 'Não encontrei agendamento compatível para registrar o atendimento.',
      } satisfies ClinicActionResult;
    }
    if (!chosen.careSubjectId) {
      return {
        ok: false,
        action: 'clinic_register_attendance_by_phone_and_time',
        verification: { found: true, matches: false, snapshot: { appointment: chosen } },
        userMessage: 'Esse agendamento não tem contexto clínico (careSubjectId).',
      } satisfies ClinicActionResult;
    }

    const complete = deps.registry.get('schedule_complete_appointment');
    if (!complete) throw new Error('schedule_complete_appointment indisponivel');
    const completed = (await complete({
      workspaceId,
      input: { appointmentId: chosen.id, notes: '', durationMinutes },
      correlationId,
    })) as { encounterId?: string; status?: string };
    const encounterId = typeof completed.encounterId === 'string' ? completed.encounterId : '';
    if (!encounterId) throw new Error('nao foi possivel concluir appointment (encounter ausente)');

    const evoBodyParts = [
      chiefComplaint ? `Queixa principal: ${chiefComplaint}` : null,
      evolutionNote ? `Evolução: ${evolutionNote}` : null,
    ].filter(Boolean);
    const evoBody = evoBodyParts.join('\n');
    if (evoBody) {
      const addEvo = deps.registry.get('clinical_add_evolution_note');
      if (!addEvo) throw new Error('clinical_add_evolution_note indisponivel');
      await addEvo({
        workspaceId,
        input: { careSubjectId: chosen.careSubjectId, body: evoBody, encounterId, appointmentId: chosen.id },
        correlationId,
      });
    }

    const packageSaleId =
      chosen.packageSaleId ?? (await packages.pickOrThrow(workspaceId, resolved.partyId)) ?? undefined;
    if (!packageSaleId) {
      return {
        ok: false,
        action: 'clinic_register_attendance_by_phone_and_time',
        verification: { found: true, matches: false, snapshot: { appointment: chosen } },
        userMessage: 'Não encontrei pacote elegível para consumir neste atendimento.',
      } satisfies ClinicActionResult;
    }

    const beforePackage = await deps.packageSales.findById(workspaceId, packageSaleId);
    const consume = deps.registry.get('package_consume_unit_once');
    if (!consume) throw new Error('package_consume_unit_once indisponivel');
    const consumeResult = (await consume({
      workspaceId,
      input: { packageSaleId, encounterId, appointmentId: chosen.id },
      correlationId,
    })) as { alreadyConsumed?: boolean; balance?: unknown };
    const afterPackage = await deps.packageSales.findById(workspaceId, packageSaleId);

    const verifiedAppointment = await deps.appointments.findById(workspaceId, chosen.id);
    const appointmentMatches = Boolean(
      verifiedAppointment &&
        verifiedAppointment.status === 'completed' &&
        verifiedAppointment.encounterId === encounterId,
    );
    const packageDeltaMatches = Boolean(
      beforePackage &&
        afterPackage &&
        afterPackage.unitsUsed === beforePackage.unitsUsed + 1 &&
        afterPackage.remaining === Math.max(0, beforePackage.remaining - 1),
    );
    const idempotentMatches = Boolean(
      consumeResult.alreadyConsumed &&
        beforePackage &&
        afterPackage &&
        beforePackage.unitsUsed === afterPackage.unitsUsed &&
        beforePackage.remaining === afterPackage.remaining &&
        afterPackage.unitsUsed > 0,
    );
    const packageMatches = consumeResult.alreadyConsumed ? idempotentMatches : packageDeltaMatches;
    const matches = appointmentMatches && packageMatches;
    const warnings = consumeResult.alreadyConsumed
      ? ['Pacote já estava consumido para este encounter (idempotência).']
      : [];
    if (!packageMatches) {
      warnings.push('Baixa não confirmada por ausência de delta persistido no saldo do pacote.');
    }
    const out: ClinicActionResult<
      { appointmentId: string; encounterId: string; packageSaleId: string },
      {
        appointment?: typeof verifiedAppointment;
        consume?: typeof consumeResult;
        packageBefore?: typeof beforePackage;
        packageAfter?: typeof afterPackage;
      }
    > = {
      ok: Boolean(verifiedAppointment) && matches,
      action: 'clinic_register_attendance_by_phone_and_time',
      write: { appointmentId: chosen.id, encounterId, packageSaleId },
      verification: {
        found: Boolean(verifiedAppointment),
        matches,
        snapshot: {
          appointment: verifiedAppointment ?? undefined,
          consume: consumeResult,
          packageBefore: beforePackage ?? undefined,
          packageAfter: afterPackage ?? undefined,
        },
        warnings,
      },
      ...(matches
        ? {}
        : {
            userMessage:
              'Atendimento concluído, mas não consegui confirmar a baixa do pacote no saldo persistido. Posso seguir com auditoria/reprocessamento da baixa.',
          }),
    };
    if (out.ok && out.verification.matches && teamContext?.teamId && conversationId?.trim()) {
      await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
        currentPatient: {
          partyId: resolved.partyId,
          careSubjectId: resolved.careSubjectId,
          name: resolved.party.displayName,
          phone: resolved.party.phone ?? resolved.phoneDigits,
        },
        lastAppointmentId: chosen.id,
        lastEncounterId: encounterId,
        currentPackageSaleId: packageSaleId,
        timezone,
      });
    }
    return out;
  });

  deps.registry.register('clinic_get_patient_full_snapshot', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const timezone = await time.resolveClinicTimezone(workspaceId);

    const overviewHandler = deps.registry.get('patient_operational_overview');
    if (!overviewHandler) throw new Error('patient_operational_overview indisponivel');
    const overview = (await overviewHandler({
      workspaceId,
      input: { partyId: resolved.partyId, appointmentLimit: 200, encounterLimit: 200 },
      correlationId,
    })) as Record<string, unknown>;

    const clinicalHandler = deps.registry.get('clinical_list_subject_history');
    if (!clinicalHandler) throw new Error('clinical_list_subject_history indisponivel');
    const clinical = await clinicalHandler({
      workspaceId,
      input: { careSubjectId: resolved.careSubjectId },
      correlationId,
    });

    const financeSummaryHandler = deps.registry.get('finance_customer_financial_summary');
    const financeOverdueHandler = deps.registry.get('finance_list_overdue_receivables');
    const financeSummary = financeSummaryHandler
      ? await financeSummaryHandler({ workspaceId, input: { partyId: resolved.partyId }, correlationId })
      : null;
    const overdue = financeOverdueHandler
      ? await financeOverdueHandler({ workspaceId, input: {}, correlationId })
      : null;
    const sessions = await deps.appointments.listByParty(workspaceId, resolved.partyId, 30);
    const sessionsLocal = sessions.map((s) => {
      const localStart = DateTime.fromISO(s.startsAt, { zone: 'utc' }).setZone(timezone);
      const localEnd = DateTime.fromISO(s.endsAt, { zone: 'utc' }).setZone(timezone);
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        localDate: localStart.toISODate(),
        localStartsAt: localStart.toFormat('HH:mm'),
        localEndsAt: localEnd.toFormat('HH:mm'),
        timezone,
        encounterId: s.encounterId,
      };
    });

    const warnings: string[] = [];
    const careSubjectsRow = overview['careSubjects'];
    if (Array.isArray(careSubjectsRow)) {
      const hasPsych = careSubjectsRow.some((s) => (s as { subjectKind?: string }).subjectKind === 'psych');
      if (!hasPsych) warnings.push('Paciente sem CareSubject psicológico.');
    }
    const packageSalesRow = overview['packageSales'];
    if (Array.isArray(packageSalesRow)) {
      const hasEligible = packageSalesRow.some((s) => Number((s as { remaining?: unknown }).remaining ?? 0) > 0);
      if (!hasEligible) warnings.push('Paciente sem pacote com saldo.');
    }
    if (sessions.some((s) => s.status === 'completed' && !s.encounterId)) {
      warnings.push('Há sessão concluída sem encounter vinculado.');
    }
    if (Array.isArray(overdue) && overdue.length > 0) {
      warnings.push('Paciente possui recebíveis vencidos em aberto.');
    }
    if (!resolved.party.phone && !resolved.phoneDigits) {
      warnings.push('Paciente sem telefone normalizado no cadastro.');
    }

    const snapshot = {
      patient: {
        partyId: resolved.partyId,
        careSubjectId: resolved.careSubjectId,
        name: resolved.party.displayName,
        phone: resolved.party.phone ?? resolved.phoneDigits,
      },
      timezone,
      sessionsLocal,
      overview,
      clinical,
      finance: {
        summary: financeSummary,
        overdueReceivables: overdue,
      },
      warnings,
    };

    const out: ClinicActionResult<undefined, typeof snapshot> = {
      ok: true,
      action: 'clinic_get_patient_full_snapshot',
      verification: { found: true, matches: true, snapshot, warnings },
    };
    return out;
  });

  deps.registry.register('clinic_context_get_current_patient', async ({ workspaceId, teamContext, conversationId }) => {
    if (!teamContext?.teamId || !conversationId?.trim()) {
      return { ok: false, action: 'clinic_context_get_current_patient', verification: { found: false, matches: false } };
    }
    const state = await deps.conversationState.get(workspaceId, teamContext.teamId, conversationId);
    return {
      ok: true,
      action: 'clinic_context_get_current_patient',
      verification: { found: true, matches: true, snapshot: { currentPatient: state?.currentPatient ?? null, state } },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_context_update_current_patient', async ({ workspaceId, input, teamContext, conversationId }) => {
    if (!teamContext?.teamId || !conversationId?.trim()) {
      return { ok: false, action: 'clinic_context_update_current_patient', verification: { found: false, matches: false } };
    }
    const data = input as Record<string, unknown>;
    const partyId = typeof data.partyId === 'string' ? data.partyId.trim() : '';
    const careSubjectId = typeof data.careSubjectId === 'string' ? data.careSubjectId.trim() : undefined;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const phone = typeof data.phone === 'string' ? data.phone.trim() : undefined;
    if (!partyId || !name) throw new Error('partyId e name obrigatorios');
    await deps.conversationState.upsert(workspaceId, teamContext.teamId, conversationId, {
      currentPatient: { partyId, careSubjectId, name, phone },
    });
    const state = await deps.conversationState.get(workspaceId, teamContext.teamId, conversationId);
    return {
      ok: true,
      action: 'clinic_context_update_current_patient',
      verification: { found: true, matches: true, snapshot: { currentPatient: state?.currentPatient ?? null } },
    } satisfies ClinicActionResult;
  });

  const delegateResult = (action: string, specialist: string, instruction: string): ClinicActionResult => ({
    ok: true,
    action,
    verification: {
      found: true,
      matches: true,
      snapshot: { delegation: { specialist, instruction, strategy: 'coordinator_handoff' } },
    },
  });
  deps.registry.register('team_delegate_to_patient_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_patient_specialist',
      'clinic_patient_crm_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );
  deps.registry.register('team_delegate_to_package_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_package_specialist',
      'clinic_package_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );
  deps.registry.register('team_delegate_to_scheduling_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_scheduling_specialist',
      'clinic_scheduling_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );
  deps.registry.register('team_delegate_to_attendance_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_attendance_specialist',
      'clinic_attendance_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );
  deps.registry.register('team_delegate_to_finance_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_finance_specialist',
      'clinic_finance_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );
  deps.registry.register('team_delegate_to_admin_audit_specialist', async ({ input }) =>
    delegateResult(
      'team_delegate_to_admin_audit_specialist',
      'clinic_admin_audit_specialist',
      String((input as Record<string, unknown>).instruction ?? ''),
    ),
  );

  deps.registry.register('clinic_add_evolution_to_existing_attendance', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const evolutionNote = typeof data.evolutionNote === 'string' ? data.evolutionNote.trim() : '';
    if (!evolutionNote) throw new Error('evolutionNote obrigatorio');
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });

    const listAttendance = deps.registry.get('attendance_list_by_party');
    if (!listAttendance) throw new Error('attendance_list_by_party indisponivel');
    const attendance = (await listAttendance({
      workspaceId,
      input: { partyId: resolved.partyId },
      correlationId,
    })) as { items?: Array<{ id?: string; appointmentId?: string }> };
    const latest = Array.isArray(attendance?.items) ? attendance.items[0] : undefined;
    const encounterId = typeof latest?.id === 'string' ? latest.id : undefined;
    const appointmentId = typeof latest?.appointmentId === 'string' ? latest.appointmentId : undefined;

    const addEvolution = deps.registry.get('clinical_add_evolution_note');
    if (!addEvolution) throw new Error('clinical_add_evolution_note indisponivel');
    await addEvolution({
      workspaceId,
      input: { careSubjectId: resolved.careSubjectId, body: evolutionNote, encounterId, appointmentId },
      correlationId,
    });
    const historyHandler = deps.registry.get('clinical_list_subject_history');
    if (!historyHandler) throw new Error('clinical_list_subject_history indisponivel');
    const history = await historyHandler({
      workspaceId,
      input: { careSubjectId: resolved.careSubjectId },
      correlationId,
    });
    const evoRows = (
      history as { evolutionNotes?: Array<{ body?: string; encounterId?: unknown; appointmentId?: unknown }> }
    ).evolutionNotes ?? [];
    const persisted = evoRows.some((row) => (row.body ?? '').trim() === evolutionNote);
    return {
      ok: persisted,
      action: 'clinic_add_evolution_to_existing_attendance',
      verification: { found: evoRows.length > 0, matches: persisted, snapshot: { encounterId, appointmentId, history } },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_create_receivable_for_session', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const amount = typeof data.amount === 'number' ? data.amount : Number(data.amount);
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate : '';
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount obrigatorio e deve ser > 0');
    if (!dueDate) throw new Error('dueDate obrigatorio');
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const summaryHandler = deps.registry.get('finance_customer_financial_summary');
    const beforeSummary = summaryHandler
      ? ((await summaryHandler({ workspaceId, input: { partyId: resolved.partyId }, correlationId })) as {
          openReceivables?: number;
        })
      : null;
    const createReceivable = deps.registry.get('finance_create_receivable');
    if (!createReceivable) throw new Error('finance_create_receivable indisponivel');
    const created = await createReceivable({
      workspaceId,
      input: {
        partyId: resolved.partyId,
        amount,
        dueDate,
        description: typeof data.description === 'string' ? data.description : 'Cobrança de sessão clínica',
        currency: typeof data.currency === 'string' ? data.currency : 'BRL',
      },
      correlationId,
    });
    const createdId = typeof (created as { id?: unknown }).id === 'string' ? String((created as { id?: unknown }).id) : '';
    const afterSummary = summaryHandler
      ? ((await summaryHandler({ workspaceId, input: { partyId: resolved.partyId }, correlationId })) as {
          openReceivables?: number;
        })
      : null;
    const beforeOpen = Number(beforeSummary?.openReceivables ?? 0);
    const afterOpen = Number(afterSummary?.openReceivables ?? 0);
    const matches = Boolean(createdId) && Number.isFinite(afterOpen) && afterOpen >= beforeOpen + amount;
    return {
      ok: matches,
      action: 'clinic_create_receivable_for_session',
      verification: {
        found: Boolean(createdId),
        matches,
        snapshot: { created, beforeOpenReceivables: beforeOpen, afterOpenReceivables: afterOpen },
      },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_get_patient_financial_summary', async ({ workspaceId, input, correlationId }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const resolved = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const summaryHandler = deps.registry.get('finance_customer_financial_summary');
    const overdueHandler = deps.registry.get('finance_list_overdue_receivables');
    const summary = summaryHandler
      ? await summaryHandler({ workspaceId, input: { partyId: resolved.partyId }, correlationId })
      : null;
    const overdue = overdueHandler ? await overdueHandler({ workspaceId, input: {}, correlationId }) : null;
    return {
      ok: true,
      action: 'clinic_get_patient_financial_summary',
      verification: { found: true, matches: true, snapshot: { summary, overdue } },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_audit_patient_integrity', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const resolution = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
    const psychSubjects = await deps.careSubjects.listByParty(workspaceId, resolution.partyId, 20);
    const psychLinked = psychSubjects.some((s) => s.subjectKind === 'psych');
    const issues = psychLinked ? [] : ['Paciente sem CareSubject psicologico vinculado'];
    return {
      ok: true,
      action: 'clinic_audit_patient_integrity',
      verification: {
        found: true,
        matches: issues.length === 0,
        snapshot: {
          partyId: resolution.partyId,
          careSubjectId: resolution.careSubjectId,
          psychLinked,
          issues,
        },
      },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_audit_appointments_integrity', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const date = typeof data.date === 'string' ? data.date : '';
    const timezone = await time.resolveClinicTimezone(workspaceId);
    const rows = phone
      ? await (async () => {
          const resolution = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone });
          return deps.appointments.listByParty(workspaceId, resolution.partyId, 100);
        })()
      : date
        ? await deps.appointments.listByLocalDate(workspaceId, date, timezone)
        : [];
    const missingLinks = rows.filter((a) => !a.careSubjectId || !a.partyId);
    const missingEncounterWhenCompleted = rows.filter((a) => a.status === 'completed' && !a.encounterId);
    return {
      ok: true,
      action: 'clinic_audit_appointments_integrity',
      verification: {
        found: true,
        matches: missingLinks.length === 0 && missingEncounterWhenCompleted.length === 0,
        snapshot: {
          total: rows.length,
          missingLinks: missingLinks.map((a) => a.id),
          missingEncounterWhenCompleted: missingEncounterWhenCompleted.map((a) => a.id),
        },
      },
    } satisfies ClinicActionResult;
  });

  deps.registry.register('clinic_repair_patient_links', async ({ workspaceId, input }) => {
    const data = input as Record<string, unknown>;
    const phone = typeof data.phone === 'string' ? data.phone : '';
    const name = typeof data.name === 'string' ? data.name : undefined;
    const before = await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone, name });
    const psychSubjects = await deps.careSubjects.listByParty(workspaceId, before.partyId, 20);
    const alreadyLinked = psychSubjects.some((s) => s.subjectKind === 'psych');
    const after = alreadyLinked
      ? before
      : await patients.findOrCreatePsychPatientByPhone(workspaceId, { phone, name });
    return {
      ok: true,
      action: 'clinic_repair_patient_links',
      verification: {
        found: true,
        matches: true,
        snapshot: {
          repaired: !alreadyLinked,
          partyId: after.partyId,
          careSubjectId: after.careSubjectId,
        },
      },
    } satisfies ClinicActionResult;
  });
}

