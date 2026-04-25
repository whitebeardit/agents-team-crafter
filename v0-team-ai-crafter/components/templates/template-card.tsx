"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileStack, Download, Share2, Pencil, Trash2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Template } from "@/lib/types"

interface TemplateCardProps {
  template: Template
  onImport?: (template: Template) => void
  onShare?: (template: Template) => void
  onEdit?: (template: Template) => void
  onDelete?: (template: Template) => void
  /** Templates da empresa no workspace (editáveis / removíveis). */
  showManageActions?: boolean
}

const originLabels = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

const originColors = {
  whitebeard: "bg-primary/10 text-primary border-primary/20",
  company: "bg-accent/10 text-accent border-accent/20",
}

export function TemplateCard({
  template,
  onImport,
  onShare,
  onEdit,
  onDelete,
  showManageActions,
}: TemplateCardProps) {
  return (
    <Card className="border-border bg-card hover:bg-card/80 transition-colors group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileStack className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{template.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-xs ${originColors[template.origin]}`}
                >
                  {originLabels[template.origin]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  v{template.version}
                </span>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {template.hasFullPayload ? "Payload completo" : "Legado"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
          {template.description}
        </p>

        {template.vertical ? (
          <p className="text-xs text-muted-foreground mt-2">
            <span className="font-medium text-foreground">Vertical:</span> {template.vertical}
          </p>
        ) : null}

        {template.prerequisites && template.prerequisites.length > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 line-clamp-2">
            Requisito: {template.prerequisites[0]}
            {template.prerequisites.length > 1 ? " …" : ""}
          </p>
        ) : null}

        {(template.validationSteps?.length ?? 0) > 0 || (template.goldenPrompts?.length ?? 0) > 0 ? (
          <p className="text-xs text-muted-foreground mt-2">
            Inclui guia de validação e prompts de teste — ver ao aplicar.
          </p>
        ) : null}

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <AgentWhitebeardIcon className="w-4 h-4" />
            {template.agentCount} no modelo
          </span>
          <Badge variant="secondary" className="text-xs">
            {template.category}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onImport?.(template)}
          >
            <Download className="w-4 h-4 mr-2" />
            Usar Template
          </Button>
          {showManageActions ? (
            <>
              <Button variant="ghost" size="icon" type="button" onClick={() => onEdit?.(template)} title="Editar">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" type="button" onClick={() => onDelete?.(template)} title="Apagar">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </>
          ) : null}
          {template.origin === "company" && !showManageActions && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShare?.(template)}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
