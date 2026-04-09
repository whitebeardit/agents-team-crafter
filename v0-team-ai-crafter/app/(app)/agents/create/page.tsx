"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AgentCreationWizard } from "@/components/agents/agent-creation-wizard"

export default function CreateAgentPage() {
  return (
    <div className="space-y-6 py-4">
      <Link
        href="/agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Agentes
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-foreground">Wizard de criação de agente</h1>
        <p className="mt-1 text-muted-foreground">
          Planeje missão, fronteiras de domínio e overlap antes de criar um novo especialista.
        </p>
      </div>
      <AgentCreationWizard />
    </div>
  )
}
