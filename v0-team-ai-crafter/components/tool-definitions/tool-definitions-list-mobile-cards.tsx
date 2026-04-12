"use client"

import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  describeToolConfig,
  describeToolDependencies,
  type TBusinessCatalogItem,
  type ToolDefinitionRow,
} from "@/lib/tool-definitions-display"

type ToolDefinitionsListMobileCardsProps = {
  items: ToolDefinitionRow[]
  catalogByActionId: Record<string, TBusinessCatalogItem>
  togglingId: string | null
  onToggle: (item: ToolDefinitionRow, enabled: boolean) => void
  onDelete: (id: string) => void
}

/**
 * Vista em cartões para viewports &lt; md (Loop 75). Paridade de ações com a tabela em md+.
 */
export function ToolDefinitionsListMobileCards({
  items,
  catalogByActionId,
  togglingId,
  onToggle,
  onDelete,
}: ToolDefinitionsListMobileCardsProps) {
  return (
    <ul className="m-0 list-none space-y-3 p-0 md:hidden" aria-label="Tools do workspace (vista em cartões)">
      {items.map((t) => (
        <li
          key={t.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{t.name}</p>
              <Badge variant={t.enabled ? "default" : "secondary"}>
                {t.enabled ? "Ativa" : "Desativada"}
              </Badge>
              <Badge variant="outline">{t.kind}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{t.slug}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {describeToolConfig(t, catalogByActionId)}
            </p>
            <p className="mt-1.5 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground">
              {describeToolDependencies(t)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ativa</span>
              <Switch
                checked={t.enabled}
                disabled={togglingId === t.id}
                onCheckedChange={(checked) => onToggle(t, checked)}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
