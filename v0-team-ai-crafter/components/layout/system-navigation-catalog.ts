import type { LucideIcon } from "lucide-react"
import {
  CalendarDays,
  ContactRound,
  HandCoins,
  Headset,
  HeartPulse,
  NotebookPen,
  Package,
} from "lucide-react"

export type SystemNavStatus = "active" | "coming-soon"

export type SystemNavItem = {
  slug: string
  name: string
  href?: string
  icon: LucideIcon
  status: SystemNavStatus
}

export const SYSTEM_NAV_ITEMS: readonly SystemNavItem[] = [
  { slug: "schedule", name: "Agenda", href: "/schedule", icon: CalendarDays, status: "active" },
  { slug: "crm", name: "CRM", href: "/crm", icon: ContactRound, status: "active" },
  { slug: "attendance", name: "Atendimento", href: "/attendance", icon: Headset, status: "active" },
  { slug: "packages", name: "Pacotes", href: "/packages", icon: Package, status: "active" },
  { slug: "finance", name: "Financeiro", icon: HandCoins, status: "coming-soon" },
  { slug: "care", name: "Care", icon: HeartPulse, status: "coming-soon" },
  { slug: "clinical", name: "Clinical", icon: NotebookPen, status: "coming-soon" },
]
