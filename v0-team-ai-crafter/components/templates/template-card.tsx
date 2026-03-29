"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileStack, Download, Share2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import type { Template } from "@/lib/types"

interface TemplateCardProps {
  template: Template
  onImport?: (template: Template) => void
  onShare?: (template: Template) => void
}

const originLabels = {
  whitebeard: "Whitebeard",
  company: "Minha Empresa",
}

const originColors = {
  whitebeard: "bg-primary/10 text-primary border-primary/20",
  company: "bg-accent/10 text-accent border-accent/20",
}

export function TemplateCard({ template, onImport, onShare }: TemplateCardProps) {
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
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {template.description}
        </p>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <AgentWhitebeardIcon className="w-4 h-4" />
            {template.agentCount} agentes
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
          {template.origin === "company" && (
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
