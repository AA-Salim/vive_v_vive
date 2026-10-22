"use client"

import { useId, type ReactNode } from "react"
import { HammerIcon, RefreshCwIcon, SwordsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DUEL_COPY } from "@/lib/duels/copy"
import { cn } from "@/lib/utils"

interface DuelShellProps {
  subtitle?: ReactNode
  aside?: ReactNode
  children?: ReactNode
  busy?: boolean
  className?: string
}

export function DuelShell({ subtitle, aside, children, busy = false, className }: DuelShellProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card shadow-[0_18px_48px_-30px_var(--color-gold)]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/70 to-transparent"
      />
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide text-[var(--color-gold)]"
          >
            <SwordsIcon className="size-[18px] shrink-0" aria-hidden />
            {DUEL_COPY.title}
          </h3>
          {subtitle && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</div>}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-1">{aside}</div>}
      </header>
      {children && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </section>
  )
}

export function DuelSkeleton() {
  return (
    <DuelShell busy subtitle={<Skeleton className="mt-1 h-3 w-52 max-w-full" />}>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </DuelShell>
  )
}

export function DuelError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <DuelShell>
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
        <div>
          <p className="font-display text-sm font-semibold text-[var(--color-gold-light)]">{DUEL_COPY.errorTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{DUEL_COPY.errorHint}</p>
        </div>
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="h-10 gap-1.5 px-4">
          <RefreshCwIcon className={cn("size-4", retrying && "animate-spin")} aria-hidden />
          Try again
        </Button>
      </div>
    </DuelShell>
  )
}

export function DuelComingSoon() {
  return (
    <DuelShell subtitle="Coming with the next royal decree">
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--color-gold)]/25 bg-[var(--color-navy)]/50 px-4 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/25">
          <HammerIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-[var(--color-gold-light)]">{DUEL_COPY.comingSoonTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{DUEL_COPY.comingSoon}</p>
        </div>
      </div>
    </DuelShell>
  )
}
