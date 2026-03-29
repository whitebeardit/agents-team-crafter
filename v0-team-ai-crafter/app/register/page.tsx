"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useWorkspaceStore } from "@/lib/store/workspace-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { ArrowRight, Loader2 } from "lucide-react"
import { AgentWhitebeardIcon } from "@/components/brand/agent-whitebeard-icon"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register } = useWorkspaceStore()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const result = await register(name, email, password)

    if (result.ok) {
      const next = searchParams.get("redirect")
      router.push(next && next.startsWith("/") ? next : "/dashboard")
    } else {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <AgentWhitebeardIcon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">TeamAgentsAICrafter</h1>
          <p className="text-muted-foreground mt-1">Crie sua conta</p>
        </div>

        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle>Cadastro</CardTitle>
            <CardDescription>Nome, email e senha (mínimo 8 caracteres)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Nome</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary border-border"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="bg-secondary border-border"
                  />
                </Field>
              </FieldGroup>

              {error && (
                <p className="text-sm text-destructive mt-4">{error}</p>
              )}

              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Desenvolvido com tecnologia Whitebeard AI
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
