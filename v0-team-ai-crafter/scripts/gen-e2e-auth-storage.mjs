/**
 * Gera e2e/.auth/storageState.json (localStorage teamagents-workspace) para Playwright.
 * Uso: E2E_API_URL=... E2E_USER_EMAIL=... E2E_USER_PASSWORD=... E2E_BASE_URL=... node scripts/gen-e2e-auth-storage.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function parseEnvelope(body) {
  const json = JSON.parse(body)
  if (!json?.success) throw new Error(`Resposta inesperada: ${body.slice(0, 200)}`)
  return json.data
}

const base = process.env.E2E_API_URL?.replace(/\/+$/, "")
const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD
const baseUrl = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "")

if (!base || !email || !password) {
  console.error("Defina E2E_API_URL, E2E_USER_EMAIL e E2E_USER_PASSWORD")
  process.exit(1)
}

const loginRes = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
})
const loginText = await loginRes.text()
if (!loginRes.ok) throw new Error(`Login falhou (${loginRes.status}): ${loginText.slice(0, 500)}`)
const { token, refreshToken } = parseEnvelope(loginText)

const authHeader = { Authorization: `Bearer ${token}` }
const workspacesRes = await fetch(`${base}/workspaces`, { headers: authHeader })
const workspacesText = await workspacesRes.text()
if (!workspacesRes.ok) throw new Error(`GET /workspaces: ${workspacesText.slice(0, 300)}`)
const workspaces = parseEnvelope(workspacesText)
if (!workspaces.length) throw new Error("Sem workspaces no utilizador")

const meRes = await fetch(`${base}/auth/me`, { headers: authHeader })
const meText = await meRes.text()
if (!meRes.ok) throw new Error(`GET /auth/me: ${meText.slice(0, 300)}`)
const me = parseEnvelope(meText)

const current = workspaces[0]
const plan = current.plan
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
      plan: w.plan,
      ...(w.logo ? { logo: w.logo } : {}),
    })),
  },
  version: 0,
})

const origin = new URL(baseUrl).origin
const outDir = path.join(root, "e2e", ".auth")
fs.mkdirSync(outDir, { recursive: true })
const storagePath = path.join(outDir, "storageState.json")
fs.writeFileSync(
  storagePath,
  JSON.stringify(
    {
      cookies: [],
      origins: [{ origin, localStorage: [{ name: "teamagents-workspace", value: storageValue }] }],
    },
    null,
    2,
  ),
  "utf8",
)
console.log("Wrote", storagePath)
