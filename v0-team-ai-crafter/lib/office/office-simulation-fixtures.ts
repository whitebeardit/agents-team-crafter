import type { OfficeEvent } from "./office-types"

export function buildDemoOfficeEvents(input: {
  coordinatorId: string
  specialistIds: string[]
}): OfficeEvent[] {
  const crm = input.specialistIds[0] ?? "demo-spec-a"
  const agenda = input.specialistIds[1] ?? crm
  const base = Date.now()

  return [
    {
      id: "demo-1",
      seq: 1,
      timestamp: new Date(base).toISOString(),
      type: "user_message",
      message: "Quero agendar atendimento para Maria.",
    },
    {
      id: "demo-2",
      seq: 2,
      timestamp: new Date(base + 1000).toISOString(),
      type: "agent_thinking",
      actorId: input.coordinatorId,
      message: "A analisar o pedido e a encaminhar ao CRM.",
    },
    {
      id: "demo-3",
      seq: 3,
      timestamp: new Date(base + 2000).toISOString(),
      type: "agent_handoff",
      fromAgentId: input.coordinatorId,
      toAgentId: crm,
      actorId: input.coordinatorId,
      message: "Verifique se Maria já existe no CRM.",
    },
    {
      id: "demo-4",
      seq: 4,
      timestamp: new Date(base + 3500).toISOString(),
      type: "agent_response",
      fromAgentId: crm,
      toAgentId: input.coordinatorId,
      actorId: crm,
      message: "Maria encontrada. Cliente ativo.",
    },
    {
      id: "demo-5",
      seq: 5,
      timestamp: new Date(base + 5000).toISOString(),
      type: "agent_handoff",
      fromAgentId: input.coordinatorId,
      toAgentId: agenda,
      actorId: input.coordinatorId,
      message: "Agora verifique horários disponíveis.",
    },
    {
      id: "demo-6",
      seq: 6,
      timestamp: new Date(base + 6500).toISOString(),
      type: "agent_response",
      fromAgentId: agenda,
      toAgentId: input.coordinatorId,
      actorId: agenda,
      message: "Encontrei horários às 15h e 16h.",
    },
  ]
}
