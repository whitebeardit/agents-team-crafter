import jwt from 'jsonwebtoken';
import type { IUserPayload } from '../../modules/auth/domain/auth-types.js';

export function createJwtService(secret: string, expiresIn: string) {
  return {
    signAccess(user: { id: string; email: string; name: string }): string {
      const payload: IUserPayload = { sub: user.id, email: user.email, name: user.name };
      return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
    },
    verifyAccess(token: string): IUserPayload {
      return jwt.verify(token, secret) as IUserPayload;
    },
  };
}
