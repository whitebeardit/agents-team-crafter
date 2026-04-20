export const INTERRUPTION_REASON_CODES = [
  'MAX_TURNS_REACHED',
  'NO_PROGRESS_DETECTED',
  'MISSING_REQUIRED_FIELDS_REPEATED',
  'EMPTY_SUBMITTED_INPUT_REPEATED',
  'AMBIGUOUS_ROUTING',
  'MISSING_REQUIRED_BINDING',
  'EXECUTION_ABORTED_BY_POLICY',
  'USER_CANCELLED',
] as const;

export type TInterruptionReasonCode = (typeof INTERRUPTION_REASON_CODES)[number];

export interface IExecutionInterruptionDescriptor {
  reasonCode: TInterruptionReasonCode;
  reasonMessage: string;
  nextStep: string;
}

export function buildExecutionInterruptionDescriptor(
  reasonCode: TInterruptionReasonCode,
  options?: { detail?: string },
): IExecutionInterruptionDescriptor {
  const detail = options?.detail?.trim();
  const suffix = detail ? ` Detalhe técnico: ${detail}` : '';
  switch (reasonCode) {
    case 'MAX_TURNS_REACHED':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução porque o fluxo atingiu o limite de turns sem concluir com segurança.${suffix}`,
        nextStep: 'Tente novamente com um pedido mais direto (ex.: listar ou buscar por identificador).',
      };
    case 'NO_PROGRESS_DETECTED':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução por falta de progresso consistente.${suffix}`,
        nextStep: 'Reformule o objetivo com os dados mínimos já conhecidos e tente novamente.',
      };
    case 'MISSING_REQUIRED_FIELDS_REPEATED':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução porque campos obrigatórios continuaram ausentes após novas tentativas.${suffix}`,
        nextStep: 'Preencha os campos obrigatórios solicitados e reexecute.',
      };
    case 'EMPTY_SUBMITTED_INPUT_REPEATED':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução porque o input chegou vazio repetidamente.${suffix}`,
        nextStep: 'Envie uma instrução objetiva com contexto mínimo para continuar.',
      };
    case 'AMBIGUOUS_ROUTING':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução porque o roteamento ficou ambíguo entre múltiplas ações possíveis.${suffix}`,
        nextStep: 'Especifique o resultado esperado e qual entidade/ferramenta deve ser priorizada.',
      };
    case 'MISSING_REQUIRED_BINDING':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução porque faltou binding obrigatório para concluir a ação.${suffix}`,
        nextStep: 'Revise o binding de tools/integrations do time e execute novamente.',
      };
    case 'EXECUTION_ABORTED_BY_POLICY':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução por política de segurança/governança.${suffix}`,
        nextStep: 'Ajuste o pedido para cumprir as políticas vigentes ou solicite revisão de permissões.',
      };
    case 'USER_CANCELLED':
      return {
        reasonCode,
        reasonMessage: `Interrompi esta execução por pedido explícito do utilizador.${suffix}`,
        nextStep: 'Quando quiser retomar, envie "continuar" com o próximo objetivo.',
      };
    default: {
      const exhaustiveCheck: never = reasonCode;
      throw new Error(`interruption reason not handled: ${String(exhaustiveCheck)}`);
    }
  }
}
