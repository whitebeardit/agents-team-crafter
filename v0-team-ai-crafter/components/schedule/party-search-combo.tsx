"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronsUpDown, Loader2 } from "lucide-react"
import { createApiClient } from "@/lib/api/client"
import type { CrmParty } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export function PartySearchCombo({
  api,
  partyId,
  partyDisplayName,
  onSelect,
}: {
  api: ReturnType<typeof createApiClient>
  partyId: string
  partyDisplayName: string
  onSelect: (id: string, displayName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [parties, setParties] = useState<CrmParty[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const load = useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const path = q.trim() ? `/parties?q=${encodeURIComponent(q.trim())}&limit=40` : "/parties?limit=40"
        const res = await api.get<CrmParty[]>(path)
        setParties(Array.isArray(res.data) ? res.data : [])
      } catch {
        setParties([])
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void load(search), 280)
    return () => clearTimeout(t)
  }, [open, search, load])

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setSearch("")
          void load("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-left">
            {partyDisplayName ? (
              <>
                <span className="font-medium">{partyDisplayName}</span>
                <span className="ml-1 font-mono text-xs text-muted-foreground">({partyId.slice(-8)})</span>
              </>
            ) : (
              <span className="text-muted-foreground">Pesquisar contato…</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome do contato…" value={search} onValueChange={setSearch} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A carregar…
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                <CommandGroup>
                  {parties.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onSelect(p.id, p.displayName)
                        setOpen(false)
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>{p.displayName}</span>
                        {(p.email || p.phone) && (
                          <span className="text-xs text-muted-foreground">
                            {[p.email, p.phone].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
