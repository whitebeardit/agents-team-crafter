import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import type { IEnv } from '../config/env.js';
import { createDeps } from '../config/container.js';

describe('clinic conversational flow (integration)', () => {
  let mongo: MongoMemoryServer;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: 'test-key',
    SLACK_SIGNING_SECRET: 'test-secret',
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);
    const ws = await WorkspaceModel.create({ name: 'ClinicWs', plan: 'free', settings: {} });
    workspaceId = ws._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('supports end-to-end clinic workflow by phone with read-after-write verification', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-28T01:49:00.000Z'));
    try {
      const deps = createDeps(env);
      const run = async (actionId: string, input: Record<string, unknown>) => {
        const r = await deps.businessToolRuntime.execute({
          workspaceId,
          toolDefinitionId: `it-${actionId}`,
          actionId,
          input,
        });
        expect(r.ok).toBe(true);
        return r.result as Record<string, unknown>;
      };

      const phone = '+55 79 988222222';

      const created = await run('clinic_create_patient', {
        name: 'Liana Rehem',
        phone,
      });
      expect(created).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_create_patient',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const sold = await run('clinic_sell_default_package', {
        phone,
        packageName: 'Pacote padrão',
        unitsTotal: 1,
      });
      expect(sold).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_sell_default_package',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const scheduled = await run('clinic_schedule_session_by_phone', {
        phone,
        dateExpression: 'amanhã',
        timeExpression: '17h',
        durationMinutes: 50,
        title: 'Consulta psicológica',
      });
      expect(scheduled).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_schedule_session_by_phone',
          write: expect.objectContaining({ appointmentId: expect.any(String) }),
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );
      const appointmentId = String((scheduled.write as { appointmentId?: unknown } | undefined)?.appointmentId ?? '');
      expect(appointmentId).toBeTruthy();

      const rescheduled = await run('clinic_reschedule_session_by_context', {
        phone,
        appointmentId: null,
        previousDateExpression: 'amanhã',
        previousTimeExpression: '17h',
        newDateExpression: 'hoje',
        newTimeExpression: '22h',
      });
      expect(rescheduled).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_reschedule_session_by_context',
          write: expect.objectContaining({ appointmentId }),
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const attended = await run('clinic_register_attendance_by_phone_and_time', {
        phone,
        dateExpression: 'hoje',
        timeExpression: '22:30',
        chiefComplaint: 'ansiedade',
        evolutionNote: 'Paciente desenvolvendo sintomas de síndrome do pânico',
        durationMinutes: 50,
      });
      expect(attended).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_register_attendance_by_phone_and_time',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const evolved = await run('clinic_add_evolution_to_existing_attendance', {
        phone,
        evolutionNote: 'Sem ideação suicida. Mantido plano terapêutico.',
      });
      expect(evolved).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_add_evolution_to_existing_attendance',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const receivable = await run('clinic_create_receivable_for_session', {
        phone,
        amount: 250,
        dueDate: '2026-04-29',
        description: 'Sessão particular',
      });
      expect(receivable).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_create_receivable_for_session',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const financial = await run('clinic_get_patient_financial_summary', { phone });
      expect(financial).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_get_patient_financial_summary',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const auditPatient = await run('clinic_audit_patient_integrity', { phone });
      expect(auditPatient).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_audit_patient_integrity',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const auditAppointments = await run('clinic_audit_appointments_integrity', { phone });
      expect(auditAppointments).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_audit_appointments_integrity',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const repair = await run('clinic_repair_patient_links', { phone, name: 'Liana Rehem' });
      expect(repair).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_repair_patient_links',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );

      const snapshot = await run('clinic_get_patient_full_snapshot', { phone });
      expect(snapshot).toEqual(
        expect.objectContaining({
          ok: true,
          action: 'clinic_get_patient_full_snapshot',
          verification: expect.objectContaining({ found: true, matches: true }),
        }),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });
});

