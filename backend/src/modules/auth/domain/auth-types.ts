export interface IUserPayload {
  sub: string;
  email: string;
  name: string;
  /** Incluído no JWT; omitido em tokens antigos = tratado como false */
  isPlatformAdmin?: boolean;
}

export type EWorkspaceRole = 'owner' | 'admin' | 'member';
