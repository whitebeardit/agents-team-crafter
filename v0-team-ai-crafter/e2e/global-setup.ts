import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { FullConfig } from "@playwright/test"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type SuccessEnvelope<T> = { success: true; data: T; meta?: Record<string, unknown> }

function parseEnvelope<T>(body: string): T {
  const json = JSON.parse(body) as SuccessEnvelope<T> | { success: false }
  if (!json || typeof json !== "object" || !("success" in json) || json.success !== true) {
    throw new Error(`Resposta inesperada: ${body.slice(0, 200)}`)
  }
  return json.data
}

export default async function globalSetup(_config: FullConfig) {
  const base = process.env.E2E_API_URL?.replace(/\/+$/, "")
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!base || !email || !password) {
    throw new Error("global-setup: defina E2E_API_URL, E2E_USER_EMAIL e E2E_USER_PASSWORD")
  }

  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const loginText = await loginRes.text()
  if (!loginRes.ok) {
    throw new Error(`Login E2E falhou (${loginRes.status}): ${loginText.slice(0, 500)}`)
  }
  const loginData = parseEnvelope<{
    token: string
    refreshToken: string
  }>(loginText)
  const { token, refreshToken } = loginData
  const authHeader = { Authorization: `Bearer ${token}` }

  const workspacesRes = await fetch(`${base}/workspaces`, { headers: authHeader })
  const workspacesText = await workspacesRes.text()
  if (!workspacesRes.ok) {
    throw new Error(`GET /workspaces falhou: ${workspacesText.slice(0, 300)}`)
  }
  const workspaces = parseEnvelope<
    Array<{ id: string; name: string; plan: string; logo?: string }>
  >(workspacesText)

  if (workspaces.length === 0) {
    throw new Error(
      "Utilizador E2E sem workspaces. Use `npm run seed` no backend (ex.: admin@whitebeard.dev) ou associe o utilizador a um workspace.",
    )
  }

  const meRes = await fetch(`${base}/auth/me`, { headers: authHeader })
  const meText = await meRes.text()
  if (!meRes.ok) {
    throw new Error(`GET /auth/me falhou: ${meText.slice(0, 300)}`)
  }
  const me = parseEnvelope<{
    id: string
    name: string
    email: string
    workspaceIds: string[]
    isPlatformAdmin?: boolean
  }>(meText)

  const current = workspaces[0]!
  const plan = current.plan as "free" | "pro" | "enterprise"
  const storageValue = JSON.stringify({
    state: {
      isAuthenticated: true,
      user: {
        id: me.id,
        name: me.name,
        email: me.email,
        workspaceIds: me.workspaceIds,
        ...(me.isPlatformAdmin ? { isPlatformAdmin: me.isPlatformAdmin } : {}),
      },
      token,
      refreshToken,
      currentWorkspace: {
        id: current.id,
        name: current.name,
        plan,
        ...(current.logo ? { logo: current.logo } : {}),
      },
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        plan: w.plan as typeof plan,
        ...(w.logo ? { logo: w.logo } : {}),
      })),
    },
    version: 0,
  })

  const baseUrl = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "")
  const origin = new URL(baseUrl).origin

  const outDir = path.join(__dirname, ".auth")
  fs.mkdirSync(outDir, { recursive: true })
  const storagePath = path.join(outDir, "storageState.json")
  fs.writeFileSync(
    storagePath,
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [{ name: "teamagents-workspace", value: storageValue }],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  )
}
