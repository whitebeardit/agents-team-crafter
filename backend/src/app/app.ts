import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { IEnv } from '../config/env.js';
import { createDeps } from '../config/container.js';
import { disconnectRedisAppClient } from '../infrastructure/redis-app.js';
import loggerPlugin from './plugins/logger.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import observabilityPlugin from './plugins/observability.js';
import { registerRoutes } from './routes.js';

export async function buildApp(env: IEnv) {
  const deps = createDeps(env);
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
            },
          }
        : true,
    });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(loggerPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(multipart, { limits: { fileSize: 1024 * 1024 } });
  await app.register(observabilityPlugin, { auditLogRepo: deps.auditLogRepo });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await registerRoutes(app, env, deps);

  app.addHook('onClose', async () => {
    disconnectRedisAppClient(deps.redis);
  });

  return app;
}
