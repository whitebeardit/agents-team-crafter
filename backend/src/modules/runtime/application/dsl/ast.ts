export type TDslRule =
  | {
      kind: 'guard';
      maxDepth?: number;
      noRepeat?: boolean;
      timeoutMs?: number;
    }
  | {
      kind: 'route_taskType';
      taskType: string;
      targetAgentId: string;
    }
  | {
      kind: 'route_toolError';
      toolName: string;
      targetAgentId?: string;
      capabilityId?: string;
      fallbackAgentId?: string;
    };

