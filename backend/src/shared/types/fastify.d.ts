import type { IUserPayload } from '../../modules/auth/domain/auth-types.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    user?: IUserPayload;
    workspaceId?: string;
    membershipRole?: 'owner' | 'admin' | 'member';
  }
}
