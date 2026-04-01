"use client"

import Link from "next/link"
import { TeamWizard } from "@/components/teams/team-wizard"
import { Button } from "@/components/ui/button"

export default function CreateTeamPage() {
  return (
    <div className="py-4">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Criar Novo Time</h1>
          <p className="text-muted-foreground mt-1">
          Configure seu time de agentes de IA passo a passo
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/teams/ai-create">Criar com Whitebeard AI</Link>
        </Button>
      </div>
      <TeamWizard />
    </div>
  )
}
