"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Loader2 } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const { isAuthenticated } = useWorkspaceStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard")
    } else {
      router.replace("/login")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Redirecionando...</span>
      </div>
    </div>
  )
}
