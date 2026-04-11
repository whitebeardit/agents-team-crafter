"use client"

import { useCallback, useEffect, useState } from "react"
import {
  useWorkspaceStore,
  type WorkspaceInviteRow,
} from "@/lib/store/workspace-store"
import { ApiError, createApiClient } from "@/lib/api/client"
import { getInviteAcceptUrl } from "@/lib/invite-url"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResponsiveTableScroll } from "@/components/ui/responsive-table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar"
import { Building2, Copy, Link2, Trash2, UserPlus } from "lucide-react"

type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

type InviteUiStatus = "pendente" | "expirado" | "aceite" | "revogado"

function getInviteUiStatus(row: WorkspaceInviteRow): InviteUiStatus {
  if (row.consumedAt) return "aceite"
  if (row.revokedAt) return "revogado"
  if (new Date(row.expiresAt).getTime() <= Date.now()) return "expirado"
  return "pendente"
}

function formatExpiryHint(iso: string): string {
  const end = new Date(iso).getTime()
  const now = Date.now()
  const days = Math.ceil((end - now) / 86400000)
  if (days < 0) return "Expirado"
  if (days === 0) return "Expira hoje"
  if (days === 1) return "Expira amanhã"
  return `Expira em ${days} dias`
}

export function WorkspaceTeamSection() {
  const {
    token,
    refreshToken,
    user,
    workspaces,
    currentWorkspace,
    createWorkspace,
    inviteMember,
    listWorkspaceInvites,
    revokeWorkspaceInvite,
    deleteWorkspaceInvite,
    promoteMemberToAdmin,
    bootstrap,
  } = useWorkspaceStore()

  const [newWsName, setNewWsName] = useState("")
  const [creating, setCreating] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member")
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string>("")
  const [inviting, setInviting] = useState(false)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [invites, setInvites] = useState<WorkspaceInviteRow[]>([])
  const [invitesLoadState, setInvitesLoadState] = useState<
    "idle" | "loading" | "ok" | "forbidden" | "error"
  >("idle")
  const [revokeTarget, setRevokeTarget] = useState<WorkspaceInviteRow | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceInviteRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isPlatformAdmin = user?.isPlatformAdmin === true
  const targetWsId = isPlatformAdmin ? inviteWorkspaceId || currentWorkspace?.id : currentWorkspace?.id

  useEffect(() => {
    if (isPlatformAdmin && workspaces.length > 0 && !inviteWorkspaceId) {
      setInviteWorkspaceId(currentWorkspace?.id ?? workspaces[0].id)
    }
  }, [isPlatformAdmin, workspaces, currentWorkspace?.id, inviteWorkspaceId])

  useEffect(() => {
    if (!token || !currentWorkspace) {
      setMembers([])
      return
    }
    const api = createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
    setLoadingMembers(true)
    void (async () => {
      try {
        const res = await api.get<MemberRow[]>(`/workspaces/${currentWorkspace.id}/members`, {
          tenant: false,
        })
        setMembers((res.data as unknown as MemberRow[]) ?? [])
      } catch {
        setMembers([])
      } finally {
        setLoadingMembers(false)
      }
    })()
  }, [token, refreshToken, currentWorkspace?.id])

  const copyInviteLink = useCallback(async (inviteId: string) => {
    try {
      await navigator.clipboard.writeText(getInviteAcceptUrl(inviteId))
      toast.success("Link copiado para a área de transferência")
    } catch {
      toast.error("Não foi possível copiar o link")
    }
  }, [])

  const loadInvites = useCallback(async () => {
    const wsId = targetWsId
    if (!token || !wsId) {
      setInvites([])
      setInvitesLoadState("idle")
      return
    }
    setInvitesLoadState("loading")
    try {
      const rows = await listWorkspaceInvites(wsId)
      setInvites(rows)
      setInvitesLoadState("ok")
    } catch (e) {
      setInvites([])
      if (e instanceof ApiError && e.status === 403) {
        setInvitesLoadState("forbidden")
      } else {
        setInvitesLoadState("error")
      }
    }
  }, [token, targetWsId, listWorkspaceInvites])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  if (!isPlatformAdmin && workspaces.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equipe e convites</CardTitle>
          <CardDescription>
            Você ainda não pertence a nenhum workspace. Aceite um convite para entrar.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleCreateWorkspace = async () => {
    const name = newWsName.trim()
    if (!name) {
      toast.error("Informe o nome do workspace")
      return
    }
    setCreating(true)
    try {
      await createWorkspace({ name })
      setNewWsName("")
      toast.success("Workspace criado")
      await bootstrap()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar workspace")
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    const wsId = targetWsId
    if (!email || !wsId) {
      toast.error("Preencha email e workspace")
      return
    }
    setInviting(true)
    try {
      const created = await inviteMember({ workspaceId: wsId, email, role: inviteRole })
      toast.success("Convite criado", {
        description: "Envie o link ao convidado (mesmo e-mail na conta).",
        action: {
          label: "Copiar link",
          onClick: () => void copyInviteLink(created.inviteId),
        },
      })
      setInviteEmail("")
      await bootstrap()
      await loadInvites()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao convidar")
    } finally {
      setInviting(false)
    }
  }

  const handlePromote = async (memberId: string) => {
    if (!currentWorkspace) return
    setPromoting(memberId)
    try {
      await promoteMemberToAdmin(currentWorkspace.id, memberId)
      toast.success("Membro promovido a admin")
      const api = createApiClient({
        getAuth: () => ({ token, refreshToken }),
        setAuth: () => {},
        clearAuth: () => {},
        getWorkspaceId: () => currentWorkspace.id,
      })
      const res = await api.get<MemberRow[]>(`/workspaces/${currentWorkspace.id}/members`, {
        tenant: false,
      })
      setMembers((res.data as unknown as MemberRow[]) ?? [])
    } catch {
      toast.error("Falha ao promover")
    } finally {
      setPromoting(null)
    }
  }

  const confirmRevoke = async () => {
    const wsId = targetWsId
    if (!revokeTarget || !wsId) return
    setRevoking(true)
    try {
      await revokeWorkspaceInvite(wsId, revokeTarget.inviteId)
      toast.success("Convite revogado — o link deixou de ser válido")
      setRevokeTarget(null)
      await loadInvites()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar")
    } finally {
      setRevoking(false)
    }
  }

  const confirmDelete = async () => {
    const wsId = targetWsId
    if (!deleteTarget || !wsId) return
    setDeleting(true)
    try {
      await deleteWorkspaceInvite(wsId, deleteTarget.inviteId)
      toast.success("Convite removido da lista")
      setDeleteTarget(null)
      await loadInvites()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar")
    } finally {
      setDeleting(false)
    }
  }

  if (isPlatformAdmin && workspaces.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Criar primeiro workspace
          </CardTitle>
          <CardDescription>
            Como administrador global, crie um workspace para começar a usar a plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Nome do workspace"
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={() => void handleCreateWorkspace()} disabled={creating}>
            {creating ? "Criando..." : "Criar workspace"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const createWorkspaceCard =
    isPlatformAdmin && workspaces.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Novo workspace
          </CardTitle>
          <CardDescription>
            Crie um tenant adicional (outra organização ou equipa). Você ficará como owner e pode
            convidar admins por e-mail abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Nome do novo workspace"
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={() => void handleCreateWorkspace()} disabled={creating}>
            {creating ? "Criando..." : "Criar workspace"}
          </Button>
        </CardContent>
      </Card>
    ) : null

  const teamCard = (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Equipe e convites
          </CardTitle>
          <CardDescription>
            Convide por e-mail (papel membro ou admin). O convidado abre o link, faz login com o mesmo
            e-mail e entra no workspace automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invitesLoadState === "forbidden" ? (
            <p className="text-sm text-muted-foreground">
              Apenas owner ou admin do workspace pode criar e gerir convites.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {isPlatformAdmin && workspaces.length > 0 && (
                  <div className="space-y-2">
                    <Label>Workspace alvo</Label>
                    <Select value={inviteWorkspaceId} onValueChange={setInviteWorkspaceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colega@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "member" | "admin")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="admin">Admin do workspace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => void handleInvite()} disabled={inviting || !targetWsId}>
                {inviting ? "Enviando..." : "Criar convite"}
              </Button>
            </>
          )}

          {invitesLoadState !== "forbidden" && invitesLoadState !== "idle" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-medium">Convites deste workspace</h3>
              </div>
              {invitesLoadState === "loading" && (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {invitesLoadState === "error" && (
                <p className="text-sm text-destructive">Não foi possível carregar os convites.</p>
              )}
              {invitesLoadState === "ok" && invites.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum convite neste workspace.</p>
              )}
              {invitesLoadState === "ok" && invites.length > 0 && (
                <ResponsiveTableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((row) => {
                        const st = getInviteUiStatus(row)
                        const label =
                          st === "pendente"
                            ? "Pendente"
                            : st === "expirado"
                              ? "Expirado"
                              : st === "aceite"
                                ? "Aceite"
                                : "Revogado"
                        const isPendente = st === "pendente"
                        return (
                          <TableRow key={row.inviteId}>
                            <TableCell className="font-medium">{row.email}</TableCell>
                            <TableCell className="capitalize">{row.role}</TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default border-b border-dotted border-muted-foreground">
                                    {label}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {st === "pendente" ? formatExpiryHint(row.expiresAt) : null}
                                    {row.expiresAt ? (
                                      <>
                                        {st === "pendente" ? <br /> : null}
                                        Expira (ISO): {new Date(row.expiresAt).toLocaleString("pt-PT")}
                                      </>
                                    ) : null}
                                    {row.consumedAt ? (
                                      <>
                                        <br />
                                        Aceite: {new Date(row.consumedAt).toLocaleString("pt-PT")}
                                      </>
                                    ) : null}
                                    {row.revokedAt ? (
                                      <>
                                        <br />
                                        Revogado: {new Date(row.revokedAt).toLocaleString("pt-PT")}
                                      </>
                                    ) : null}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {isPendente ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      aria-label={`Copiar link do convite para ${row.email}`}
                                      onClick={() => void copyInviteLink(row.inviteId)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      aria-label={`Revogar convite para ${row.email}`}
                                      onClick={() => setRevokeTarget(row)}
                                    >
                                      Revogar
                                    </Button>
                                  </>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Apagar convite da lista para ${row.email}`}
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  <Trash2 className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Apagar</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTableScroll>
              )}
            </div>
          )}

          <AlertDialog
            open={revokeTarget !== null}
            onOpenChange={(open) => {
              if (!open) setRevokeTarget(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
                <AlertDialogDescription>
                  Convite para {revokeTarget?.email}: o link deixa de aceitar entradas; o registo mantém-se
                  na lista como &quot;Revogado&quot;. Para ocultar de vez, use Apagar depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={revoking}
                  onClick={() => void confirmRevoke()}
                >
                  {revoking ? "A revogar..." : "Revogar"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar convite da lista?</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove o registo de {deleteTarget?.email}. Se ainda estiver pendente, o link também deixa
                  de funcionar. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                >
                  {deleting ? "A apagar..." : "Apagar"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        {currentWorkspace && (
          <>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <WorkspaceAvatar
                name={currentWorkspace.name}
                logo={currentWorkspace.logo}
                className="h-6 w-6 shrink-0"
              />
              <span>
                Membros em <strong>{currentWorkspace.name}</strong>
              </span>
            </p>
            {loadingMembers ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum membro listado.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{m.name || m.email}</span>
                      <span className="text-muted-foreground ml-2">{m.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase text-muted-foreground">{m.role}</span>
                      {m.role === "member" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={promoting === m.id}
                          onClick={() => void handlePromote(m.id)}
                        >
                          {promoting === m.id ? "..." : "Promover a admin"}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  )

  if (createWorkspaceCard) {
    return (
      <div className="space-y-6">
        {createWorkspaceCard}
        {teamCard}
      </div>
    )
  }

  return teamCard
}
