import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Workspace, User, TeamWizardData } from "@/lib/types"
import { ApiError, createApiClient } from "@/lib/api/client"

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
        const wsRes = await api.get<Array<Pick<Workspace, "id" | "name" | "logo" | "plan">>>("/workspaces", {
          tenant: false,
        })
        const workspaces = wsRes.data as unknown as Workspace[]
        const current = get().currentWorkspace
        const nextCurrent =
          (current && workspaces.find((w) => w.id === current.id)) ?? workspaces[0] ?? null
        set({ workspaces, currentWorkspace: nextCurrent })
      },
      
      setCurrentWorkspace: (workspace: Workspace) => {
        set({ currentWorkspace: workspace })
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
