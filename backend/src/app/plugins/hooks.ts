import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import type { preHandlerHookHandler } from 'fastify';
import type { IUserPayload } from '../../modules/auth/domain/auth-types.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { MemberRepository } from '../../modules/workspaces/infra/member.repository.js';

export function buildAuthenticate(secret: string): preHandlerHookHandler {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Token ausente', 401);
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, secret) as IUserPayload;
      req.user = payload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Token invalido ou expirado', 401);
    }
  };
}

export function buildRequireTenant(memberRepo: MemberRepository): preHandlerHookHandler {
  return async (req: FastifyRequest) => {
    const wid = req.headers['x-workspace-id'];
    if (!wid || typeof wid !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'X-Workspace-Id obrigatorio', 400);
    }
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Nao autenticado', 401);
    }
    const role = await memberRepo.findRole(req.user.sub, wid);
    if (!role) {
      throw new AppError('FORBIDDEN', 'Usuario nao pertence ao workspace', 403);
    }
    req.workspaceId = wid;
    req.membershipRole = role;
  };
}
