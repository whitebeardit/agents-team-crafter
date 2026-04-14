export type TBusinessActionOperationType = 'read' | 'write' | 'delete';

export function classifyBusinessActionOperation(actionId: string): TBusinessActionOperationType {
  const id = actionId.trim().toLowerCase();
  if (!id) return 'read';

  if (/_delete_|_cancel_|_remove_|_archive_/.test(id)) return 'delete';
  if (
    /_create_|_update_|_add_|_mark_|_confirm_|_reschedule_|_close_|_complete_|_comment_/.test(id)
  ) {
    return 'write';
  }
  return 'read';
}

export function operationPolicyPromptLine(operation: TBusinessActionOperationType): string {
  if (operation === 'read') {
    return 'READ: executa direto sem pedir confirmação redundante; só pergunta se houver ambiguidade real de filtro.';
  }
  if (operation === 'delete') {
    return 'DELETE: pede uma confirmação explícita única antes de executar; após confirmação, executa sem reconfirmar.';
  }
  return 'WRITE: pede apenas obrigatórios em falta numa única pergunta compacta; opcionais podem ser oferecidos uma vez sem bloquear execução.';
}
