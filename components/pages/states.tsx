"use client"

import type { ReactNode } from "react"
import { type LucideIcon, RefreshCwIcon, ScrollTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface PageErrorProps {
  title?: string
  message?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function PageError({
  title = "The royal scribes dropped the scrolls",
  message = "This page could not be loaded. Nothing is lost, the ink is just drying.",
  onRetry,
  retrying = false,
  className,
}: PageErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-gold)]/20 bg-card px-5 py-10 text-center",
        className
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/25">
        <ScrollTextIcon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold text-[var(--color-gold)]">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="h-10 px-4">
          <RefreshCwIcon className={cn("size-4", retrying && "animate-spin")} aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

interface PageEmptyProps {
  icon?: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageEmpty({ icon: Icon = ScrollTextIcon, title, children, action, className }: PageEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-gold)]/25 bg-card/60 px-5 py-12 text-center",
        className
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)]/80 ring-1 ring-[var(--color-gold)]/20">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold text-[var(--color-gold)]">{title}</p>
      {children ? <div className="max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

interface SectionCardProps {
  title: string
  id?: string
  eyebrow?: string
  description?: ReactNode
  action?: ReactNode
  help?: HelpEntry
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({ title, id, eyebrow, description, action, help, children, className, bodyClassName }: SectionCardProps) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/15 bg-card", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/40 to-transparent"
      />
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <h2 id={headingId} className="min-w-0 font-display text-lg leading-snug font-semibold text-[var(--color-gold-light)]">
              {title}
            </h2>
            {help ? <InfoTip help={help} side="bottom" align="start" /> : null}
          </div>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className={cn("px-4 pt-3 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  )
}
