"use client"

import { TeamCreationHub } from "@/components/teams/team-creation-hub"

export default function AiCreateTeamPage() {
  return (
    <div className="py-4">
      <TeamCreationHub defaultTab="assistant" />
    </div>
  )
}
