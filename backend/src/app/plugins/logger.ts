import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

const loggerPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req) => {
    const headerId = req.headers['x-request-id'];
    req.requestId = typeof headerId === 'string' ? headerId : randomUUID();
  });
};

export default fp(loggerPlugin, { name: 'request-id' });
