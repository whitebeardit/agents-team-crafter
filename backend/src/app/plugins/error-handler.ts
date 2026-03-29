import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { errorEnvelope } from '../../shared/kernel/envelope.js';

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      req.log.warn({ err, requestId: req.requestId }, 'Zod validation');
      return reply.status(400).send(
        errorEnvelope('VALIDATION_ERROR', err.issues[0]?.message ?? 'Validacao falhou', {
          issues: err.flatten(),
        }),
      );
    }
    if (err instanceof AppError) {
      req.log.warn({ err, requestId: req.requestId }, (err as Error).message);
      return reply.status(err.httpStatus).send(errorEnvelope(err.code, (err as Error).message, err.details));
    }
    req.log.error({ err, requestId: req.requestId }, (err as Error).message);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const code = status === 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
    const message = status === 500 ? 'Erro interno do servidor' : (err as Error).message;
    return reply.status(status >= 400 ? status : 500).send(errorEnvelope(code, message, {}));
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler' });
