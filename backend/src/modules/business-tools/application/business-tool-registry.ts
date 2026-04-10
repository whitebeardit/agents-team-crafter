/**
 * Registry of internal business actions keyed by stable `actionId` (e.g. `business.ping`, `crm_create_party`).
 */
export type TBusinessActionContext = {
  workspaceId: string;
  input: unknown;
  correlationId?: string;
};

export type TBusinessActionHandler = (ctx: TBusinessActionContext) => Promise<unknown>;

export class BusinessToolRegistry {
  private readonly handlers = new Map<string, TBusinessActionHandler>();

  register(actionId: string, handler: TBusinessActionHandler): void {
    const id = actionId.trim();
    if (!id) throw new Error('actionId required');
    this.handlers.set(id, handler);
  }

  get(actionId: string): TBusinessActionHandler | undefined {
    return this.handlers.get(actionId.trim());
  }

  has(actionId: string): boolean {
    return this.handlers.has(actionId.trim());
  }
}
