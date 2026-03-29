"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"
import { toast } from "sonner"

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const inviteId = typeof params.inviteId === "string" ? params.inviteId : ""
  const { isAuthenticated, acceptInvite, bootstrap } = useWorkspaceStore()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!inviteId || !isAuthenticated || done || ranRef.current) return
    ranRef.current = true
    setBusy(true)
    void (async () => {
      try {
        await acceptInvite(inviteId)
        toast.success("Convite aceito")
        setDone(true)
        await bootstrap()
        router.replace("/dashboard")
      } catch (e) {
        ranRef.current = false
        toast.error(e instanceof Error ? e.message : "Não foi possível aceitar o convite")
      } finally {
        setBusy(false)
      }
    })()
  }, [inviteId, isAuthenticated, acceptInvite, bootstrap, router, done])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AgentWhitebeardIcon className="h-12 w-12" />
            </div>
            <CardTitle>Convite para workspace</CardTitle>
            <CardDescription>
              Faça login com a conta que recebeu o convite (mesmo e-mail).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href={`/login?redirect=${encodeURIComponent(`/invite/${inviteId}`)}`}>
                Ir para login
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/register?redirect=${encodeURIComponent(`/invite/${inviteId}`)}`}>
                Criar conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <p className="text-muted-foreground">{busy ? "A aceitar convite..." : "A redirecionar..."}</p>
    </div>
  )
}
