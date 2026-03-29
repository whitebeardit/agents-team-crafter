"use client"

import { TeamWizard } from "@/components/teams/team-wizard"

export default function CreateTeamPage() {
  return (
    <div className="py-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Criar Novo Time</h1>
        <p className="text-muted-foreground mt-1">
          Configure seu time de agentes de IA passo a passo
        </p>
      </div>
      <TeamWizard />
    </div>
  )
}
