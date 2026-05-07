"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamWizard } from "@/components/teams/team-wizard"
import { TeamAiBuilder } from "@/components/teams/team-ai-builder"
import { Button } from "@/components/ui/button"
import { FileStack, Upload } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import { toast } from "sonner"
import type { TeamImportResult } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function TeamCreationHub({
  defaultTab = "assistant",
}: {
  defaultTab?: "assistant" | "manual" | "template"
}) {
  const router = useRouter()
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setImporting(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as unknown
      const res = await api.post<TeamImportResult>("/teams/import", { payload, forceCreate: true })
      for (const w of res.data.warnings) {
        toast.message(w)
      }
      toast.success("Time criado a partir do ficheiro.")
      router.push(`/teams/${res.data.teamId}`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Falha ao importar o JSON (time)"
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <ContextualTourHost screenKey="ai_builder" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Criar novo time</h1>
          <p className="mt-1 text-muted-foreground">
            IA, template do catálogo, ou configuração guiada. Importa um JSON de time (v2) para replicar um stack completo.
          </p>
        </div>
        <ContextualTourManualTrigger screenKey="ai_builder" />
      </div>
      <Tabs defaultValue={defaultTab === "template" ? "template" : defaultTab}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-secondary p-1 sm:grid-cols-3 sm:inline-flex sm:min-w-0 sm:max-w-full sm:flex-wrap sm:justify-center">
          <TabsTrigger value="assistant" className="min-h-10 px-2 text-center sm:px-3">
            Assistido por IA
          </TabsTrigger>
          <TabsTrigger value="template" className="min-h-10 px-2 text-center sm:px-3">
            A partir de template
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-h-10 px-2 text-center sm:px-3">
            Configuração guiada
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assistant" className="mt-6">
          <TeamAiBuilder embedded />
        </TabsContent>
        <TabsContent value="template" className="mt-6 space-y-4">
          <Alert>
            <FileStack className="h-4 w-4" />
            <AlertTitle>Catálogo e ficheiro</AlertTitle>
            <AlertDescription className="mt-1 space-y-2 text-sm text-muted-foreground">
              <p>Os templates (JSON sem segredos) reutilizam o import de time no servidor. Para um ficheiro de time completo, use a importação abaixo (equivalente a Times → Importar).</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" asChild>
                  <Link href="/templates">Abrir catálogo de templates</Link>
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!token || !currentWorkspace || importing}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? "A importar…" : "Importar JSON (time v2, novo time)"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>
        <TabsContent value="manual" className="mt-6">
          <TeamWizard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
