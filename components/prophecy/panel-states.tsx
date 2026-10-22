"use client"

import { useId, type ReactNode } from "react"
import { RefreshCwIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface PanelShellProps {
  icon: LucideIcon
  title: string
  subtitle?: ReactNode
  aside?: ReactNode
  help?: HelpEntry
  children?: ReactNode
  className?: string
}

// Shared frame: a thin gold crest across the top, a display-serif title, and an optional right-hand slot.
export function PanelShell({ icon: Icon, title, subtitle, aside, help, children, className }: PanelShellProps) {
  const headingId = useId()
  return (
    <Card aria-labelledby={headingId} role="region" className={cn("relative gap-0 overflow-hidden py-0", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/70 to-transparent"
      />
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 id={headingId} className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide text-[var(--color-gold)]">
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {title}
            </h3>
            {help && <InfoTip help={help} side="bottom" align="start" />}
          </div>
          {subtitle && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children && <CardContent className="space-y-3 px-4 pb-4">{children}</CardContent>}
    </Card>
  )
}

export function PanelSkeleton({ icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <PanelShell icon={icon} title={title} subtitle={<Skeleton className="mt-1 h-3 w-48" />}>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </PanelShell>
  )
}

export function PanelError({
  icon,
  title,
  message,
  onRetry,
}: {
  icon: LucideIcon
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <PanelShell icon={icon} title={title}>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onRetry} className="h-10 gap-1.5 px-4">
          <RefreshCwIcon className="size-4" aria-hidden />
          Try again
        </Button>
      </div>
    </PanelShell>
  )
}

export function ComingSoon({
  icon,
  title,
  help,
  children,
}: {
  icon: LucideIcon
  title: string
  help?: HelpEntry
  children: ReactNode
}) {
  return (
    <PanelShell icon={icon} title={title} help={help} subtitle="Coming with the next royal decree">
      <div className="rounded-xl border border-dashed border-[var(--color-gold)]/25 bg-[var(--color-navy)]/50 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </PanelShell>
  )
}
