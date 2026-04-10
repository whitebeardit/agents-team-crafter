"use client"

import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Loader2, Pencil } from "lucide-react"
import { ApiError, createApiClient } from "@/lib/api/client"
import type { CrmParty } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function EditPartyDialog({
  api,
  partyId,
  initialParty,
  trigger,
  onUpdated,
}: {
  api: ReturnType<typeof createApiClient>
  partyId: string
  initialParty?: CrmParty | null
  trigger?: ReactNode
  onUpdated?: (party: CrmParty) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) return
    const src = initialParty?.id === partyId ? initialParty : undefined
    if (src) {
      setDisplayName(src.displayName ?? "")
      setEmail(src.email ?? "")
      setPhone(src.phone ?? "")
      setNotes(src.notes ?? "")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const r = await api.get<CrmParty>(`/parties/${partyId}`)
        if (cancelled) return
        setDisplayName(r.data.displayName ?? "")
        setEmail(r.data.email ?? "")
        setPhone(r.data.phone ?? "")
        setNotes(r.data.notes ?? "")
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Não foi possível carregar o contato"
        toast.error(msg)
        setOpen(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Intencional: não depender de `initialParty` por identidade — evita reset ao editar com o pai a re-renderizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao abrir o diálogo ou mudar o contato
  }, [open, partyId, api])

  async function submit() {
    if (!displayName.trim()) {
      toast.error("Indique o nome do contato.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      }
      const res = await api.put<CrmParty>(`/parties/${partyId}`, payload)
      toast.success("Contato atualizado")
      onUpdated?.(res.data)
      setOpen(false)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível atualizar o contato"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>Atualize os dados do contato comercial neste workspace.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ep-name">Nome *</Label>
                <Input
                  id="ep-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex.: Clínica Silva"
                  autoComplete="organization"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ep-email">E-mail</Label>
                  <Input
                    id="ep-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="opcional"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-phone">Telefone</Label>
                  <Input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="opcional" autoComplete="tel" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-notes">Notas</Label>
                <Textarea id="ep-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" rows={2} className="resize-none" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
