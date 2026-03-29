export interface IUserPayload {
  sub: string;
  email: string;
  name: string;
}

export type EWorkspaceRole = 'owner' | 'admin' | 'member';
