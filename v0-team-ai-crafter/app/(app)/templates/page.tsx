"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FileStack } from "lucide-react"
import { TemplateCard } from "@/components/templates/template-card"
import type { AgentOrigin, Channel, Template } from "@/lib/types"
import { toast } from "sonner"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export default function TemplatesPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [originFilter, setOriginFilter] = useState<AgentOrigin | "all">("all")
  const [templates, setTemplates] = useState<Template[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    if (!token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    void (async () => {
      const qs = new URLSearchParams()
      if (originFilter !== "all") qs.set("origin", originFilter)
      const [templatesRes, channelsRes] = await Promise.all([
        api.get<Template[]>(`/templates?${qs.toString()}`),
        api.get<Channel[]>("/channels"),
      ])
      setTemplates(templatesRes.data)
      setChannels(channelsRes.data)
    })()
  }, [token, refreshToken, currentWorkspace, originFilter])

  const filteredTemplates =
    originFilter === "all"
      ? templates
      : templates.filter((t) => t.origin === originFilter)

  const whitebeardCount = templates.filter(
    (t) => t.origin === "whitebeard"
  ).length
  const companyCount = templates.filter((t) => t.origin === "company").length

  const resetApplyModal = () => {
    setSelectedTemplate(null)
    setTeamName("")
    setTeamDescription("")
    setSelectedChannelIds([])
  }

  const handleImport = (template: Template) => {
    setSelectedTemplate(template)
    setTeamName(`${template.name} - Novo Time`)
    setTeamDescription(template.description || "")
    setSelectedChannelIds([])
  }

  const handleShare = (template: Template) => {
    toast.info(`Compartilhamento de "${template.name}" em breve!`)
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !teamName.trim() || !token || !currentWorkspace) return
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setIsApplying(true)
    try {
      await api.post(`/templates/${selectedTemplate.id}/apply`, {
        teamName: teamName.trim(),
        teamDescription: teamDescription.trim() || undefined,
        channelIds: selectedChannelIds,
      })
      toast.success("Template aplicado com sucesso")
      resetApplyModal()
    } catch {
      toast.error("Falha ao aplicar template")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Templates</h1>
        <p className="text-muted-foreground mt-1">
          Use templates prontos para criar times rapidamente
        </p>
      </div>

      {/* Origin Tabs */}
      <Tabs
        value={originFilter}
        onValueChange={(v) => setOriginFilter(v as AgentOrigin | "all")}
      >
        <TabsList className="bg-secondary">
          <TabsTrigger value="all">
            Todos
            <Badge variant="secondary" className="ml-2">
              {templates.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="whitebeard">
            Whitebeard
            <Badge variant="secondary" className="ml-2">
              {whitebeardCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="company">
            Meus Templates
            <Badge variant="secondary" className="ml-2">
              {companyCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onImport={handleImport}
              onShare={handleShare}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileStack className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            Nenhum template encontrado
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Templates aparecerão aqui quando disponíveis
          </p>
        </div>
      )}

      <Dialog open={Boolean(selectedTemplate)} onOpenChange={(open) => !open && resetApplyModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aplicar template</DialogTitle>
            <DialogDescription>
              Crie um novo time a partir de <strong>{selectedTemplate?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-team-name">Nome do time</Label>
              <Input
                id="template-team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Nome do novo time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-team-description">Descricao (opcional)</Label>
              <Textarea
                id="template-team-description"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Canais iniciais (opcional)</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {channels.map((channel) => (
                  <label key={channel.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedChannelIds.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedChannelIds((prev) => [...prev, channel.id])
                          return
                        }
                        setSelectedChannelIds((prev) => prev.filter((id) => id !== channel.id))
                      }}
                    />
                    <span>{channel.name}</span>
                  </label>
                ))}
                {channels.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum canal cadastrado.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetApplyModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={isApplying || !teamName.trim()}
            >
              {isApplying ? "Aplicando..." : "Aplicar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
