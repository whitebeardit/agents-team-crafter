"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Download, FileStack, Info, Share2 } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ContextualTourHost, ContextualTourManualTrigger } from "@/components/onboarding/contextual-tour"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"

type TemplateApplyDetail = Template & {
  agents?: Array<{ id?: string; name?: string; role?: string }>
}

const TEMPLATE_ORIGIN_LABELS: Record<AgentOrigin, string> = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

export default function TemplatesPage() {
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [originFilter, setOriginFilter] = useState<AgentOrigin | "all">("all")
  const [templates, setTemplates] = useState<Template[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [applyDetail, setApplyDetail] = useState<TemplateApplyDetail | null>(null)
  const [applyDetailLoading, setApplyDetailLoading] = useState(false)
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

  useEffect(() => {
    if (!token || !currentWorkspace || !selectedTemplate) {
      setApplyDetail(null)
      return
    }
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    let cancelled = false
    setApplyDetailLoading(true)
    setApplyDetail(null)
    void (async () => {
      try {
        const r = await api.get<TemplateApplyDetail>(`/templates/${selectedTemplate.id}`)
        if (!cancelled) setApplyDetail(r.data)
      } catch {
        if (!cancelled) setApplyDetail(null)
      } finally {
        if (!cancelled) setApplyDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, refreshToken, currentWorkspace, selectedTemplate?.id])

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
    setApplyDetail(null)
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
      <ContextualTourHost screenKey="templates_catalog" />
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Catalogo alinhado ao seed: cada modelo indica quantos agentes referencia e os requisitos antes de aplicar.
          </p>
        </div>
        <ContextualTourManualTrigger screenKey="templates_catalog" />
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

      {/* Catálogo: cartões (TemplateCard) vs tabela — Loop 76 */}
      {filteredTemplates.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onImport={handleImport}
                onShare={handleShare}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <ResponsiveTableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="whitespace-nowrap">v / Categoria</TableHead>
                    <TableHead className="text-right">Agentes</TableHead>
                    <TableHead className="min-w-[160px]">Descrição</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="font-medium">{template.name}</div>
                        {template.vertical ? (
                          <div className="text-xs text-muted-foreground">Vertical: {template.vertical}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TEMPLATE_ORIGIN_LABELS[template.origin]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        v{template.version} · {template.category}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{template.agentCount}</TableCell>
                      <TableCell
                        className="max-w-[280px] truncate text-sm text-muted-foreground"
                        title={template.description}
                      >
                        {template.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImport(template)}
                            className="gap-1"
                          >
                            <Download className="h-4 w-4 shrink-0" />
                            Usar
                          </Button>
                          {template.origin === "company" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => handleShare(template)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableScroll>
          </div>
        </>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar template</DialogTitle>
            <DialogDescription>
              Crie um novo time a partir de <strong>{selectedTemplate?.name}</strong>. Leia os requisitos antes de
              confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {applyDetailLoading ? (
              <p className="text-sm text-muted-foreground">A carregar detalhes do template...</p>
            ) : null}

            {applyDetail?.prerequisites && applyDetail.prerequisites.length > 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Requisitos</AlertTitle>
                <AlertDescription asChild>
                  <ul className="list-disc pl-4 text-sm space-y-1 mt-2">
                    {applyDetail.prerequisites.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.applyBehavior ? (
              <Alert variant="default" className="border-muted">
                <AlertTitle className="text-sm">O que acontece ao aplicar</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {applyDetail.applyBehavior}
                </AlertDescription>
              </Alert>
            ) : null}

            {applyDetail?.agents && applyDetail.agents.length > 0 ? (
              <div className="rounded-md border border-border p-3 space-y-1">
                <p className="text-sm font-medium">Agentes referenciados no modelo</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {applyDetail.agents.map((a, i) => (
                    <li key={i}>
                      {a.name ?? "—"} {a.role ? <span className="text-foreground">({a.role})</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  O servidor associa por nome; o coordenador efectivo segue a regra do backend (primeiro coordenador
                  do workspace).
                </p>
              </div>
            ) : null}

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
              disabled={isApplying || !teamName.trim() || applyDetailLoading}
            >
              {isApplying ? "Aplicando..." : "Aplicar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
