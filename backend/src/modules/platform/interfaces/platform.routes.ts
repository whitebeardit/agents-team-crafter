import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { wipeAllApplicationCollections } from '../application/wipe-factory-collections.js';

const factoryResetBodySchema = z.object({
  confirmPhrase: z.literal('RESET_FACTORY_INSTALLATION'),
  /** Deve coincidir com o email do token (confirmação humana). */
  confirmEmail: z.string().email(),
  acknowledgeIrreversible: z.literal(true),
  /** Obrigatório em produção quando o reset em produção está permitido por env. */
  productionSafetyPhrase: z.literal('DELETE_ALL_PRODUCTION_DATA').optional(),
});

function factoryResetAllowed(env: IAppDeps['env']): { ok: true } | { ok: false; reason: string } {
  if (env.DANGER_ZONE_FACTORY_RESET_ENABLED !== '1') {
    return { ok: false, reason: 'DANGER_ZONE_FACTORY_RESET_ENABLED nao esta ativo no servidor.' };
  }
  if (env.NODE_ENV === 'production' && env.DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION !== '1') {
    return {
      ok: false,
      reason:
        'Reset em ambiente production exige DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION=1 no servidor.',
    };
  }
  return { ok: true };
}

function requiresProductionSafetyPhrase(env: IAppDeps['env']): boolean {
  return env.NODE_ENV === 'production' && env.DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION === '1';
}

export async function registerPlatformRoutes(app: FastifyInstance, deps: IAppDeps) {
  const platformAdmin = [deps.authenticate, deps.requirePlatformAdmin];

  app.get('/platform/danger-zone/status', { preHandler: platformAdmin }, async (_req, reply) => {
    const gate = factoryResetAllowed(deps.env);
    return reply.send(
      successEnvelope({
        factoryResetAvailable: gate.ok,
        blockedReason: gate.ok ? null : gate.reason,
        requiresProductionSafetyPhrase: gate.ok ? requiresProductionSafetyPhrase(deps.env) : false,
      }),
    );
  });

  app.post('/platform/danger-zone/factory-reset', { preHandler: platformAdmin }, async (req, reply) => {
    const gate = factoryResetAllowed(deps.env);
    if (!gate.ok) {
      throw new AppError('FORBIDDEN', gate.reason, 403);
    }

    const body = factoryResetBodySchema.parse(req.body ?? {});
    const tokenEmail = (req.user!.email ?? '').trim().toLowerCase();
    if (tokenEmail !== body.confirmEmail.trim().toLowerCase()) {
      throw new AppError('VALIDATION_ERROR', 'confirmEmail deve coincidir com o email da sessao', 400);
    }

    if (requiresProductionSafetyPhrase(deps.env)) {
      if (body.productionSafetyPhrase !== 'DELETE_ALL_PRODUCTION_DATA') {
        throw new AppError(
          'VALIDATION_ERROR',
          'Em producao e obrigatorio productionSafetyPhrase=DELETE_ALL_PRODUCTION_DATA',
          400,
        );
      }
    }

    req.log.warn(
      {
        event: 'platform.factory_reset',
        userId: req.user!.sub,
        email: tokenEmail,
        requestId: req.requestId,
      },
      'Factory reset iniciado (wipe MongoDB)',
    );

    const { byCollection, totalDeleted } = await wipeAllApplicationCollections();

    return reply.send(
      successEnvelope({
        ok: true,
        totalDeleted,
        byCollection,
        message:
          'Base apagada. Volte a executar seed (ex.: npm run seed:demo) para dados de demonstracao.',
      }),
    );
  });
}
