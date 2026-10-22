import type { ReactNode } from "react"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  help?: HelpEntry
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, help, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 font-display text-3xl leading-tight font-semibold text-[var(--color-gold)] sm:text-4xl">{title}</h1>
          {help ? <InfoTip help={help} side="bottom" align="start" /> : null}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-gold-light)]/70">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
