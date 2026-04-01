"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Images, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createApiClient } from "@/lib/api/client"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface IGalleryAlbum {
  subjectSlug: string
  fileCount: number
}

interface IGalleryFile {
  filename: string
  sizeBytes: number
  createdAt: string
}

export default function TeamGalleryPage() {
  const params = useParams<{ id: string }>()
  const teamId = params.id
  const { token, refreshToken, currentWorkspace } = useWorkspaceStore()
  const [albums, setAlbums] = useState<IGalleryAlbum[]>([])
  const [loadingAlbums, setLoadingAlbums] = useState(true)
  const [subject, setSubject] = useState<string | null>(null)
  const [files, setFiles] = useState<IGalleryFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})
  const blobUrlsRef = useRef<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{ filename: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const api = useMemo(() => {
    if (!token || !currentWorkspace) return null
    return createApiClient({
      getAuth: () => ({ token, refreshToken }),
      setAuth: () => {},
      clearAuth: () => {},
      getWorkspaceId: () => currentWorkspace.id,
    })
  }, [token, refreshToken, currentWorkspace])

  useEffect(() => {
    if (!api) return
    let cancelled = false
    setLoadingAlbums(true)
    void (async () => {
      try {
        const res = await api.get<{ albums: IGalleryAlbum[] }>(`/teams/${teamId}/gallery`)
        if (!cancelled) setAlbums(res.data.albums)
      } catch {
        if (!cancelled) toast.error("Não foi possível carregar a galeria")
      } finally {
        if (!cancelled) setLoadingAlbums(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, teamId])

  useEffect(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrlsRef.current = []
    setBlobUrls({})
    setFiles([])

    if (!api || !subject) {
      setLoadingFiles(false)
      return
    }

    let cancelled = false
    setLoadingFiles(true)
    void (async () => {
      try {
        const encSub = encodeURIComponent(subject)
        const listRes = await api.get<{ files: IGalleryFile[] }>(`/teams/${teamId}/gallery/${encSub}/files`)
        if (cancelled) return
        setFiles(listRes.data.files)

        const next: Record<string, string> = {}
        const created: string[] = []
        for (const f of listRes.data.files) {
          if (cancelled) break
          const res = await api.fetchAuthorized(
            `/teams/${teamId}/gallery/${encSub}/file/${encodeURIComponent(f.filename)}`,
          )
          if (!res.ok) continue
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          created.push(url)
          next[f.filename] = url
        }
        blobUrlsRef.current = created
        if (!cancelled) setBlobUrls(next)
      } catch {
        if (!cancelled) toast.error("Falha ao carregar imagens do álbum")
      } finally {
        if (!cancelled) setLoadingFiles(false)
      }
    })()

    return () => {
      cancelled = true
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [api, teamId, subject])

  async function confirmDelete() {
    if (!api || !subject || !deleteTarget) return
    setDeleting(true)
    try {
      const encSub = encodeURIComponent(subject)
      await api.del(`/teams/${teamId}/gallery/${encSub}/file/${encodeURIComponent(deleteTarget.filename)}`)
      toast.success("Imagem removida")
      setDeleteTarget(null)
      const listRes = await api.get<{ albums: IGalleryAlbum[] }>(`/teams/${teamId}/gallery`)
      setAlbums(listRes.data.albums)
      const filesRes = await api.get<{ files: IGalleryFile[] }>(`/teams/${teamId}/gallery/${encSub}/files`)
      setFiles(filesRes.data.files)
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
      const next: Record<string, string> = {}
      const created: string[] = []
      for (const f of filesRes.data.files) {
        const res = await api.fetchAuthorized(
          `/teams/${teamId}/gallery/${encSub}/file/${encodeURIComponent(f.filename)}`,
        )
        if (!res.ok) continue
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        created.push(url)
        next[f.filename] = url
      }
      blobUrlsRef.current = created
      setBlobUrls(next)
    } catch {
      toast.error("Não foi possível remover")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/teams/${teamId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao time
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Images className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Galeria</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Imagens geradas pela tool de geração de imagens e guardadas por assunto (pasta).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="border-border h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Álbuns</CardTitle>
            <CardDescription>Assunto derivado do prompt</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingAlbums ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : albums.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma imagem guardada ainda.</p>
            ) : (
              <ScrollArea className="h-[min(420px,50vh)] pr-3">
                <ul className="space-y-1">
                  {albums.map((a) => (
                    <li key={a.subjectSlug}>
                      <button
                        type="button"
                        onClick={() => setSubject(a.subjectSlug)}
                        className={cn(
                          "w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors",
                          subject === a.subjectSlug
                            ? "bg-primary/15 text-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="line-clamp-2">{a.subjectSlug}</span>
                        <span className="text-xs opacity-70 tabular-nums">({a.fileCount})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border min-h-[320px]">
          <CardHeader>
            <CardTitle className="text-base">{subject ? `Assunto: ${subject}` : "Selecione um álbum"}</CardTitle>
            {subject ? (
              <CardDescription>
                {files.length} ficheiro(s)
                {loadingFiles ? " · a carregar pré-visualizações…" : null}
              </CardDescription>
            ) : (
              <CardDescription>Escolha um assunto à esquerda para ver as imagens.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!subject ? null : loadingFiles && files.length === 0 ? (
              <p className="text-sm text-muted-foreground">A carregar…</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este álbum está vazio.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {files.map((f) => {
                  const src = blobUrls[f.filename]
                  return (
                    <div
                      key={f.filename}
                      className="group relative rounded-lg border border-border bg-muted/30 overflow-hidden"
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- blob URLs from API
                          <img src={src} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground">…</span>
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-xs font-mono truncate" title={f.filename}>
                          {f.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(f.createdAt), "d MMM yyyy HH:mm", { locale: ptBR })} ·{" "}
                          {(f.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ filename: f.filename })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Apagar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O ficheiro será removido do disco do servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
