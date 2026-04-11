/**
 * Breakpoints alinhados ao Tailwind v4 default (`tailwindcss`):
 * - `sm`: 640px
 * - `md`: 768px — referência **tablet** no roadmap ETAPA 9
 * - `lg`: 1024px — **desktop** mínimo (sidebar fixa visível)
 * - `xl`: 1280px
 *
 * Uso no app autenticado: `lg:` para shell completo; `md:` para densidade intermédia.
 * Larguras de referência do plano: 390 (mobile), 768 (tablet), 1024 (desktop).
 */
export const VIEWPORT_REFERENCE = {
  mobile: 390,
  tablet: 768,
  desktop: 1024,
} as const
