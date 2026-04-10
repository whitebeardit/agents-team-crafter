import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { IAppDeps } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { hashToken, generateRefreshToken } from '../../../shared/utils/hash-token.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  name: z.string().min(1, 'Nome e obrigatorio').max(120),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance, deps: IAppDeps) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await deps.userRepo.findByEmail(body.email);
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Este email ja esta cadastrado', 409);
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await deps.userRepo.create({
      email: body.email,
      passwordHash,
      name: body.name,
    });
    const access = deps.jwt.signAccess({
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
    });
    const refresh = generateRefreshToken();
    await deps.userRepo.updateRefreshToken(user.id, hashToken(refresh));
    const decoded = jwt.decode(access) as { exp: number };
    return reply.send(
      successEnvelope({
        token: access,
        refreshToken: refresh,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          workspaceIds: user.workspaceIds,
          isPlatformAdmin: user.isPlatformAdmin,
        },
      }),
    );
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await deps.userRepo.findByEmail(body.email);
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new AppError('INVALID_CREDENTIALS', 'Email ou senha invalidos', 401);
    }
    const access = deps.jwt.signAccess({
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
    });
    const refresh = generateRefreshToken();
    await deps.userRepo.updateRefreshToken(user.id, hashToken(refresh));
    const decoded = jwt.decode(access) as { exp: number };
    return reply.send(
      successEnvelope({
        token: access,
        refreshToken: refresh,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          workspaceIds: user.workspaceIds,
          isPlatformAdmin: user.isPlatformAdmin,
        },
      }),
    );
  });

  app.post('/auth/logout', { preHandler: [deps.authenticate] }, async (req, reply) => {
    await deps.userRepo.updateRefreshToken(req.user!.sub, null);
    return reply.send(successEnvelope({ message: 'Logout realizado com sucesso' }));
  });

  app.get('/auth/me', { preHandler: [deps.authenticate] }, async (req, reply) => {
    const user = await deps.userRepo.findById(req.user!.sub);
    if (!user) throw new AppError('UNAUTHORIZED', 'Usuario nao encontrado', 401);
    return reply.send(
      successEnvelope({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        workspaceIds: user.workspaceIds,
        isPlatformAdmin: user.isPlatformAdmin,
      }),
    );
  });

  app.post('/auth/refresh', async (req, reply) => {
    const body = refreshSchema.parse(req.body);
    const user = await deps.userRepo.findByRefreshTokenHash(hashToken(body.refreshToken));
    if (!user) throw new AppError('UNAUTHORIZED', 'Refresh token invalido', 401);
    const access = deps.jwt.signAccess({
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
    });
    const refresh = generateRefreshToken();
    await deps.userRepo.updateRefreshToken(user.id, hashToken(refresh));
    const decoded = jwt.decode(access) as { exp: number };
    return reply.send(
      successEnvelope({
        token: access,
        refreshToken: refresh,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      }),
    );
  });
}
