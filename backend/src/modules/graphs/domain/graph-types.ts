export interface IGraphNode {
  id: string;
  type: string;
  data?: { agentId?: string; channelId?: string; label?: string; description?: string };
  position?: { x: number; y: number };
}

export interface IGraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  data?: { edgeKind?: string };
  label?: string;
}

export interface IValidationIssue {
  code: string;
  message: string;
}

export interface IGraphValidationResult {
  valid: boolean;
  warnings: IValidationIssue[];
  errors: IValidationIssue[];
}
