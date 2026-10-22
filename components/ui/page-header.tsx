import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

// The standard top of a page: small kicker, display-serif title, one line of lore, optional actions.
function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="type-eyebrow text-[var(--color-gold)]/85">{eyebrow}</p>}
        <h1 className="type-title gilded">{title}</h1>
        {description && <p className="type-body max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export { PageHeader }
