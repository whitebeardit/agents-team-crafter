"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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

export function CreatePartyDialog({
  api,
  trigger,
  onCreated,
}: {
  api: ReturnType<typeof createApiClient>
  trigger: React.ReactNode
  onCreated?: (party: CrmParty) => void
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  function reset() {
    setDisplayName("")
    setEmail("")
    setPhone("")
    setNotes("")
  }

  async function submit() {
    if (!displayName.trim()) {
      toast.error("Indique o nome do contato.")
      return
    }
    setSaving(true)
    try {
      const res = await api.post<CrmParty>("/parties", {
        displayName: displayName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      toast.success("Contato criado")
      onCreated?.(res.data)
      setOpen(false)
      reset()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Não foi possível criar o contato"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>Cadastre um contato comercial no workspace para usar na agenda e em outros fluxos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Nome *</Label>
            <Input
              id="cp-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Clínica Silva"
              autoComplete="organization"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cp-email">E-mail</Label>
              <Input
                id="cp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="opcional"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-phone">Telefone</Label>
              <Input id="cp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="opcional" autoComplete="tel" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-notes">Notas</Label>
            <Textarea id="cp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" rows={2} className="resize-none" />
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
      </DialogContent>
    </Dialog>
  )
}
