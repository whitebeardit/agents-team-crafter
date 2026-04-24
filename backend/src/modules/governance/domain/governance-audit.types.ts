/** Eventos de auditoria de governanca (ETAPA 7.1). */
export type TGovernanceAuditEventType =
  | 'governance.overlap_review'
  | 'governance.agent_blocked'
  | 'governance.overlap_warning_allowed'
  | 'governance.override_applied'
  | 'governance.team_plan_execute'
  | 'governance.team_import'
  | 'governance.team_plan_blocked'
  | 'governance.agent_plan_execute'
  | 'governance.agent_plan_blocked'
  | 'governance.slo_breached'
  | 'governance.audit_purged';
