"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamWizard } from "@/components/teams/team-wizard"
import { TeamAiBuilder } from "@/components/teams/team-ai-builder"

export function TeamCreationHub({
  defaultTab = "assistant",
}: {
  defaultTab?: "assistant" | "manual"
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Criar novo time</h1>
        <p className="mt-1 text-muted-foreground">
          Uma jornada única: comece pelo objetivo com assistência da plataforma ou use o fallback manual.
        </p>
      </div>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-secondary p-1 sm:inline-flex sm:w-auto sm:min-w-0">
          <TabsTrigger value="assistant" className="min-h-10 px-2 text-center sm:px-3">
            Assistido por IA
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-h-10 px-2 text-center sm:px-3">
            Fallback manual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assistant" className="mt-6">
          <TeamAiBuilder embedded />
        </TabsContent>
        <TabsContent value="manual" className="mt-6">
          <TeamWizard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
