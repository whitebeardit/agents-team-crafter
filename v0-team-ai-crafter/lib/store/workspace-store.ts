import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Workspace, User, TeamWizardData } from "@/lib/types"
import { ApiError, createApiClient } from "@/lib/api/client"

export type WorkspaceInviteRow = {
  inviteId: string
  email: string
  role: "member" | "admin"
  expiresAt: string
  consumedAt?: string
  revokedAt?: string
  createdAt: string
}

interface WorkspaceState {
  // Auth state
  isAuthenticated: boolean
  user: User | null
  token: string | null
  refreshToken: string | null
  
  // Workspace state
  currentWorkspace: Workspace | null
  workspaces: Workspace[]
  
  // Team wizard state
  wizardData: TeamWizardData
  wizardStep: number
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => Promise<void>
  bootstrap: () => Promise<void>
  setCurrentWorkspace: (workspace: Workspace) => void
  refreshSessionUser: () => Promise<void>
  createWorkspace: (input: {
    name: string
    logo?: string
    plan?: "free" | "pro" | "enterprise"
  }) => Promise<void>
  inviteMember: (input: {
    workspaceId: string
    email: string
    role: "member" | "admin"
  }) => Promise<{ inviteId: string; email: string; role: "member" | "admin"; expiresAt: string }>
  listWorkspaceInvites: (workspaceId: string) => Promise<WorkspaceInviteRow[]>
  revokeWorkspaceInvite: (workspaceId: string, inviteId: string) => Promise<void>
  deleteWorkspaceInvite: (workspaceId: string, inviteId: string) => Promise<void>
  promoteMemberToAdmin: (workspaceId: string, userId: string) => Promise<void>
  acceptInvite: (inviteId: string) => Promise<void>

  // Wizard actions
  setWizardStep: (step: number) => void
  updateWizardData: (data: Partial<TeamWizardData>) => void
  resetWizard: () => void
}

const initialWizardData: TeamWizardData = {
  name: "",
  description: "",
  objective: "",
  primaryChannel: null,
  coordinatorId: null,
  specialistIds: [],
  channelIds: [],
  nodes: [],
  edges: [],
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      currentWorkspace: null,
      workspaces: [],
      wizardData: initialWizardData,
      wizardStep: 1,
      
      // Auth actions
      login: async (email: string, password: string) => {
        try {
          const api = createApiClient({
            getAuth: () => ({ token: null, refreshToken: null }),
            setAuth: () => {},
            clearAuth: () => {},
            getWorkspaceId: () => null,
          })
          const res = await api.post<{
            token: string
            refreshToken: string
            expiresAt: string
            user: User
          }>("/auth/login", { email, password }, { tenant: false })
          set({
            isAuthenticated: true,
            user: res.data.user,
            token: res.data.token,
            refreshToken: res.data.refreshToken,
          })
          await get().bootstrap()
          return true
        } catch {
          return false
        }
      },

      register: async (name: string, email: string, password: string) => {
        try {
          const api = createApiClient({
            getAuth: () => ({ token: null, refreshToken: null }),
            setAuth: () => {},
            clearAuth: () => {},
            getWorkspaceId: () => null,
          })
          const res = await api.post<{
            token: string
            refreshToken: string
            expiresAt: string
            user: User
          }>("/auth/register", { name, email, password }, { tenant: false })
          set({
            isAuthenticated: true,
            user: res.data.user,
            token: res.data.token,
            refreshToken: res.data.refreshToken,
          })
          await get().bootstrap()
          return { ok: true as const }
        } catch (e) {
          if (e instanceof ApiError && e.code === "EMAIL_TAKEN") {
            return { ok: false as const, error: "Este email já está cadastrado." }
          }
          if (e instanceof ApiError) {
            return { ok: false as const, error: e.message }
          }
          return { ok: false as const, error: "Não foi possível criar a conta. Tente novamente." }
        }
      },
      
      logout: async () => {
        const { token, refreshToken } = get()
        try {
          const api = createApiClient({
            getAuth: () => ({ token, refreshToken }),
            setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
            clearAuth: () => set({ token: null, refreshToken: null }),
            getWorkspaceId: () => get().currentWorkspace?.id,
          })
          await api.post("/auth/logout", {}, { tenant: false })
        } catch {
          // ignore logout errors in MVP
        }
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          currentWorkspace: null,
          workspaces: [],
        })
      },

      bootstrap: async () => {
        const { token, refreshToken } = get()
        if (!token) return
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => get().currentWorkspace?.id,
        })
        const [wsRes, meRes] = await Promise.all([
          api.get<Array<Pick<Workspace, "id" | "name" | "logo" | "plan">>>("/workspaces", {
            tenant: false,
          }),
          api.get<{
            id: string
            name: string
            email: string
            avatar?: string
            workspaceIds: string[]
            isPlatformAdmin?: boolean
          }>("/auth/me", { tenant: false }),
        ])
        const workspaces = wsRes.data as unknown as Workspace[]
        const current = get().currentWorkspace
        const nextCurrent =
          (current && workspaces.find((w) => w.id === current.id)) ?? workspaces[0] ?? null
        set({
          workspaces,
          currentWorkspace: nextCurrent,
          user: meRes.data as unknown as User,
        })
      },
      
      setCurrentWorkspace: (workspace: Workspace) => {
        set({ currentWorkspace: workspace })
      },

      refreshSessionUser: async () => {
        const { token, refreshToken } = get()
        if (!token) return
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => get().currentWorkspace?.id,
        })
        const res = await api.get<{
          id: string
          name: string
          email: string
          avatar?: string
          workspaceIds: string[]
          isPlatformAdmin?: boolean
        }>("/auth/me", { tenant: false })
        set({ user: res.data as unknown as User })
      },

      createWorkspace: async (input) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => null,
        })
        const res = await api.post<{
          id: string
          name: string
          logo?: string
          plan: Workspace["plan"]
          settings: Record<string, unknown>
        }>("/workspaces", input, { tenant: false })
        await get().bootstrap()
        const ws = get().workspaces.find((w) => w.id === res.data.id)
        if (ws) set({ currentWorkspace: ws })
      },

      inviteMember: async ({ workspaceId, email, role }) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => workspaceId,
        })
        const res = await api.post<{
          inviteId: string
          email: string
          role: "member" | "admin"
          expiresAt: string
        }>(`/workspaces/${workspaceId}/members/invite`, { email, role }, { tenant: false })
        return res.data
      },

      listWorkspaceInvites: async (workspaceId) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => workspaceId,
        })
        const res = await api.get<WorkspaceInviteRow[]>(`/workspaces/${workspaceId}/invites`, {
          tenant: false,
        })
        return (res.data as unknown as WorkspaceInviteRow[]) ?? []
      },

      revokeWorkspaceInvite: async (workspaceId, inviteId) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => workspaceId,
        })
        await api.post<{ ok: boolean }>(
          `/workspaces/${workspaceId}/invites/${inviteId}/revoke`,
          {},
          { tenant: false },
        )
      },

      deleteWorkspaceInvite: async (workspaceId, inviteId) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => workspaceId,
        })
        await api.del<{ ok: boolean }>(`/workspaces/${workspaceId}/invites/${inviteId}`, {
          tenant: false,
        })
      },

      promoteMemberToAdmin: async (workspaceId, userId) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => workspaceId,
        })
        await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role: "admin" as const }, { tenant: false })
      },

      acceptInvite: async (inviteId) => {
        const { token, refreshToken } = get()
        if (!token) throw new Error("Nao autenticado")
        const api = createApiClient({
          getAuth: () => ({ token, refreshToken }),
          setAuth: (auth) => set({ token: auth.token, refreshToken: auth.refreshToken ?? refreshToken }),
          clearAuth: () => set({ token: null, refreshToken: null, isAuthenticated: false, user: null }),
          getWorkspaceId: () => get().currentWorkspace?.id,
        })
        await api.post(`/workspaces/invites/${inviteId}/accept`, {}, { tenant: false })
        await get().bootstrap()
        await get().refreshSessionUser()
      },

      // Wizard actions
      setWizardStep: (step: number) => {
        set({ wizardStep: step })
      },
      
      updateWizardData: (data: Partial<TeamWizardData>) => {
        set((state) => ({
          wizardData: { ...state.wizardData, ...data },
        }))
      },
      
      resetWizard: () => {
        set({
          wizardData: initialWizardData,
          wizardStep: 1,
        })
      },
    }),
    {
      name: "teamagents-workspace",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        currentWorkspace: state.currentWorkspace,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
